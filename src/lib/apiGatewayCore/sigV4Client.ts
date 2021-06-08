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
import SHA256 from "crypto-js/sha256";
import encHex from "crypto-js/enc-hex";
import HmacSHA256 from "crypto-js/hmac-sha256";
import urlParser from "url";
import utils from "./utils";

const sigV4ClientFactory: any = {};
sigV4ClientFactory.newClient = function (config: any): any {
  let AWS_SHA_256 = "AWS4-HMAC-SHA256";
  let AWS4_REQUEST = "aws4_request";
  let AWS4 = "AWS4";
  let X_AMZ_DATE = "x-amz-date";
  let X_AMZ_SECURITY_TOKEN = "x-amz-security-token";
  let HOST = "host";
  let AUTHORIZATION = "Authorization";

  function hash(value: any) {
    return SHA256(value); // eslint-disable-line
  }

  function hexEncode(value: any) {
    return value.toString(encHex);
  }

  function hmac(secret: any, value: any) {
    return HmacSHA256(value, secret); // eslint-disable-line
  }

  function buildCanonicalRequest(
    method: any,
    path: any,
    queryParams: any,
    headers: any,
    payload: any
  ) {
    return (
      method +
      "\n" +
      buildCanonicalUri(path) +
      "\n" +
      buildCanonicalQueryString(queryParams) +
      "\n" +
      buildCanonicalHeaders(headers) +
      "\n" +
      buildCanonicalSignedHeaders(headers) +
      "\n" +
      hexEncode(hash(payload))
    );
  }

  function hashCanonicalRequest(request: any) {
    return hexEncode(hash(request));
  }

  function buildCanonicalUri(uri: any) {
    return encodeURI(uri);
  }

  function buildCanonicalQueryString(queryParams: any) {
    if (Object.keys(queryParams).length < 1) {
      return "";
    }

    let sortedQueryParams = [];
    for (let property in queryParams) {
      if (Object.prototype.hasOwnProperty.call(queryParams, property)) {
        sortedQueryParams.push(property);
      }
    }
    sortedQueryParams.sort();

    let canonicalQueryString = "";
    for (let sortedQueryParam of sortedQueryParams) {
      canonicalQueryString +=
        sortedQueryParam +
        "=" +
        fixedEncodeURIComponent(queryParams[sortedQueryParam]) +
        "&";
    }
    return canonicalQueryString.substr(0, canonicalQueryString.length - 1);
  }

  function fixedEncodeURIComponent(str: any) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
      return "%" + c.charCodeAt(0).toString(16);
    });
  }

  function buildCanonicalHeaders(headers: any) {
    let canonicalHeaders = "";
    let sortedKeys = [];
    for (let property in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, property)) {
        sortedKeys.push(property);
      }
    }
    sortedKeys.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    for (let i = 0; i < sortedKeys.length; i++) {
      canonicalHeaders +=
        sortedKeys[i].toLowerCase() + ":" + headers[sortedKeys[i]] + "\n";
    }
    return canonicalHeaders;
  }

  function buildCanonicalSignedHeaders(headers: any) {
    let sortedKeys = [];
    for (let property in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, property)) {
        sortedKeys.push(property.toLowerCase());
      }
    }
    sortedKeys.sort();

    return sortedKeys.join(";");
  }

  function buildStringToSign(
    datetime: any,
    credentialScope: any,
    hashedCanonicalRequest: any
  ) {
    return (
      AWS_SHA_256 +
      "\n" +
      datetime +
      "\n" +
      credentialScope +
      "\n" +
      hashedCanonicalRequest
    );
  }

  function buildCredentialScope(datetime: any, region: any, service: any) {
    return (
      datetime.substr(0, 8) + "/" + region + "/" + service + "/" + AWS4_REQUEST
    );
  }

  function calculateSigningKey(
    secretKey: any,
    datetime: any,
    region: any,
    service: any
  ) {
    return hmac(
      hmac(
        hmac(hmac(AWS4 + secretKey, datetime.substr(0, 8)), region),
        service
      ),
      AWS4_REQUEST
    );
  }

  function calculateSignature(key: any, stringToSign: any) {
    return hexEncode(hmac(key, stringToSign));
  }

  function buildAuthorizationHeader(
    accessKey: any,
    credentialScope: any,
    headers: any,
    signature: any
  ) {
    return (
      AWS_SHA_256 +
      " Credential=" +
      accessKey +
      "/" +
      credentialScope +
      ", SignedHeaders=" +
      buildCanonicalSignedHeaders(headers) +
      ", Signature=" +
      signature
    );
  }

  let awsSigV4Client: any = {};
  if (config.accessKey === undefined || config.secretKey === undefined) {
    return awsSigV4Client;
  }
  awsSigV4Client.accessKey = utils.assertDefined(config.accessKey, "accessKey");
  awsSigV4Client.secretKey = utils.assertDefined(config.secretKey, "secretKey");
  awsSigV4Client.sessionToken = config.sessionToken;
  awsSigV4Client.serviceName = utils.assertDefined(
    config.serviceName,
    "serviceName"
  );
  awsSigV4Client.region = utils.assertDefined(config.region, "region");
  awsSigV4Client.endpoint = utils.assertDefined(config.endpoint, "endpoint");
  awsSigV4Client.retries = config.retries;
  awsSigV4Client.retryCondition = config.retryCondition;
  awsSigV4Client.retryDelay = config.retryDelay;
  awsSigV4Client.host = config.host;

  awsSigV4Client.makeRequest = function (request: any): any {
    let verb = utils.assertDefined(request.verb, "verb");
    let path = utils.assertDefined(request.path, "path");
    let queryParams = utils.copy(request.queryParams);
    let timeout = utils.copy(request.timeout);

    if (queryParams === undefined) {
      queryParams = {};
    }

    if (timeout === undefined) {
      timeout = 0;
    }
    let headers = utils.copy(request.headers);
    if (headers === undefined) {
      headers = {};
    }

    // If the user has not specified an override for Content type the use default
    if (headers["Content-Type"] === undefined) {
      headers["Content-Type"] = config.defaultContentType;
    }

    // If the user has not specified an override for Accept type the use default
    if (headers["Accept"] === undefined) {
      headers["Accept"] = config.defaultAcceptType;
    }

    let body = utils.copy(request.body);

    // stringify request body if content type is JSON
    if (
      body &&
      headers["Content-Type"] &&
      headers["Content-Type"] === "application/json"
    ) {
      body = JSON.stringify(body);
    }

    // If there is no body remove the content-type header so it is not included in SigV4 calculation
    if (body === "" || body === undefined || body === null) {
      delete headers["Content-Type"];
    }

    let datetime = new Date(new Date().getTime() + config.systemClockOffset)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z")
      .replace(/[:-]|\.\d{3}/g, "");
    headers[X_AMZ_DATE] = datetime;

    if (awsSigV4Client.host) {
      headers[HOST] = awsSigV4Client.host;
    } else {
      let parser = urlParser.parse(awsSigV4Client.endpoint);
      headers[HOST] = parser.hostname;
    }

    let canonicalRequest = buildCanonicalRequest(
      verb,
      path,
      queryParams,
      headers,
      body
    );
    let hashedCanonicalRequest = hashCanonicalRequest(canonicalRequest);
    let credentialScope = buildCredentialScope(
      datetime,
      awsSigV4Client.region,
      awsSigV4Client.serviceName
    );
    let stringToSign = buildStringToSign(
      datetime,
      credentialScope,
      hashedCanonicalRequest
    );
    let signingKey = calculateSigningKey(
      awsSigV4Client.secretKey,
      datetime,
      awsSigV4Client.region,
      awsSigV4Client.serviceName
    );
    let signature = calculateSignature(signingKey, stringToSign);
    headers[AUTHORIZATION] = buildAuthorizationHeader(
      awsSigV4Client.accessKey,
      credentialScope,
      headers,
      signature
    );
    if (
      awsSigV4Client.sessionToken !== undefined &&
      awsSigV4Client.sessionToken !== ""
    ) {
      headers[X_AMZ_SECURITY_TOKEN] = awsSigV4Client.sessionToken;
    }
    delete headers[HOST];

    let url = config.endpoint + path;
    let queryString = buildCanonicalQueryString(queryParams);
    if (queryString !== "") {
      url += "?" + queryString;
    }

    // Need to re-attach Content-Type if it is not specified at this point
    if (headers["Content-Type"] === undefined) {
      headers["Content-Type"] = config.defaultContentType;
    }

    let signedRequest: AxiosRequestConfig = {
      headers: headers,
      timeout: timeout,
      data: body,
      method: verb,
      url,
    };
    if (config.retries !== undefined) {
      signedRequest.baseURL = url;
      let client = axios.create(signedRequest);

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
        retryCondition: config.retryCondition,
        retryDelay,
      });
      return client.request(signedRequest);
    }

    return axios(signedRequest);
  };

  return awsSigV4Client;
};

export default sigV4ClientFactory;
