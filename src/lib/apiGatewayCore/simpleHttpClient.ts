/*
 * Copyright 2010-2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import axios, { AxiosRequestConfig } from "axios";
import axiosRetry from "axios-retry";
import utils from "./utils";

class simpleHttpClientFactory {
  static newClient(config: any) {
    function buildCanonicalQueryString(queryParams: any) {
      // Build a properly encoded query string from a QueryParam object
      if (Object.keys(queryParams).length < 1) {
        return "";
      }

      let canonicalQueryString = "";
      for (let property in queryParams) {
        if (Object.prototype.hasOwnProperty.call(queryParams, property)) {
          canonicalQueryString +=
            encodeURIComponent(property) +
            "=" +
            encodeURIComponent(queryParams[property]) +
            "&";
        }
      }

      return canonicalQueryString.substr(0, canonicalQueryString.length - 1);
    }

    const simpleHttpClient: any = {};
    simpleHttpClient.endpoint = utils.assertDefined(
      config.endpoint,
      "endpoint"
    );

    simpleHttpClient.makeRequest = function (request: any) {
      const verb = utils.assertDefined(request.verb, "verb");
      const path = utils.assertDefined(request.path, "path");
      let queryParams = utils.copy(request.queryParams);
      let timeout = utils.copy(request.timeout);
      if (queryParams === undefined) {
        queryParams = {};
      }
      if (timeout === undefined) {
        timeout = 0;
      }
      const headers = { ...utils.copy(request.headers), ...config.headers };

      // If the user has not specified an override for Content type the use default
      if (headers["Content-Type"] === undefined) {
        headers["Content-Type"] = config.defaultContentType;
      }

      // If the user has not specified an override for Accept type the use default
      if (headers["Accept"] === undefined) {
        headers["Accept"] = config.defaultAcceptType;
      }

      const body = utils.copy(request.body);

      let url = config.endpoint + path;
      const queryString = buildCanonicalQueryString(queryParams);
      if (queryString !== "") {
        url += "?" + queryString;
      }

      const simpleHttpRequest: AxiosRequestConfig = {
        headers: headers,
        timeout: timeout,
        data: body,
        method: verb,
        url: url,
      };
      if (config.retries !== undefined) {
        simpleHttpRequest.baseURL = url;
        const client = axios.create(simpleHttpRequest);

        // Allow user configurable delay, or built-in exponential delay
        let retryDelay: any = () => 0;
        if (config.retryDelay === "exponential") {
          retryDelay = axiosRetry.exponentialDelay;
        } else if (typeof config.retryDelay === "number") {
          retryDelay = () => parseInt(config.retryDelay);
        } else if (typeof config.retryDelay === "function") {
          retryDelay = config.retryDelay;
        }

        axiosRetry(client, {
          ...config,
          retryCondition:
            typeof config.retryCondition === "function"
              ? config.retryCondition
              : axiosRetry.isNetworkOrIdempotentRequestError,
          retryDelay,
        });
        return client.request(simpleHttpRequest);
      }
      return axios(simpleHttpRequest);
    };

    return simpleHttpClient;
  }
}

export default simpleHttpClientFactory;
