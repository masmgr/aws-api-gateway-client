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

import axios, {
  AxiosError,
  AxiosPromise,
  AxiosRequestConfig,
  Method,
} from "axios";
import axiosRetry, { IAxiosRetryConfig } from "axios-retry";
import utils, { QueryParams } from "./utils";

export interface simpleHttpClientFactoryConfig {
  endpoint: string;
  headers?: object;
  defaultContentType: string;
  defaultAcceptType: string;
  retries: number;
  retryDelay: "exponential" | number | (() => number);
  retryCondition: (error: AxiosError) => boolean;
}

export interface simpleHttpClientRequest {
  verb: Method | undefined;
  path: string | undefined;
  queryParams: QueryParams;
  timeout: number | undefined;
  request: object | undefined;
  headers: Headers;
  body: Body;
}

export interface simpleHttpClient {
  endpoint: string;
  makeRequest(request: simpleHttpClientRequest): AxiosPromise<any>;
}

class simpleHttpClientFactory {
  static newClient(config: simpleHttpClientFactoryConfig) {
    function buildCanonicalQueryString(queryParams: QueryParams) {
      // Build a properly encoded query string from a QueryParam object
      if (Object.keys(queryParams).length < 1) {
        return "";
      }

      let canonicalQueryString = "";
      for (const property in queryParams) {
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

    return {
      endpoint: utils.assertDefined(config.endpoint, "endpoint"),
      makeRequest: function (request: simpleHttpClientRequest) {
        const verb: Method = utils.assertDefined(request.verb, "verb");
        const path: string = utils.assertDefined(request.path, "path");
        let queryParams = utils.copy(request.queryParams);
        let timeout: number | undefined = utils.copy(request.timeout);
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
          url,
        };
        if (config.retries !== undefined) {
          simpleHttpRequest.baseURL = url;
          const client = axios.create(simpleHttpRequest);

          // Allow user configurable delay, or built-in exponential delay
          let retryDelay: (retryNumber: number) => number = () => 0;
          if (config.retryDelay === "exponential") {
            retryDelay = axiosRetry.exponentialDelay;
          } else if (typeof config.retryDelay === "number") {
            retryDelay = () => config.retryDelay as number;
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
      },
    } as simpleHttpClient;
  }
}

export default simpleHttpClientFactory;
