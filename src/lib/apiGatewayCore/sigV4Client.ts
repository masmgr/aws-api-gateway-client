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
} from 'axios'
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry'
import SHA256 from 'crypto-js/sha256'
import encHex from 'crypto-js/enc-hex'
import HmacSHA256 from 'crypto-js/hmac-sha256'
import urlParser from 'url'
import utils from './utils'
import {
    simpleHttpClient,
    simpleHttpClientFactoryConfig,
    simpleHttpClientRequest,
} from './simpleHttpClient'
type WordArray = CryptoJS.lib.WordArray

export interface awsSigV4ClientFactoryConfig
    extends simpleHttpClientFactoryConfig {
    systemClockOffset: string
    accessKey: string
    secretKey: string
    sessionToken: string
    serviceName: string
    region: string
    host: string
}

export interface awsSigV4ClientRequest extends simpleHttpClientRequest {}

export interface awsSigV4Client extends simpleHttpClient {
    accessKey: string
    secretKey: string
    sessionToken: string
    serviceName: string
    region: string
    retries: number
    retryDelay: 'exponential' | number | (() => number)
    retryCondition: (error: AxiosError) => boolean
    host: string
    makeRequest: (request: awsSigV4ClientRequest) => AxiosPromise<any>
}

class sigV4ClientFactory {
    static newClient(config: awsSigV4ClientFactoryConfig): awsSigV4Client {
        const AWS_SHA_256 = 'AWS4-HMAC-SHA256'
        const AWS4_REQUEST = 'aws4_request'
        const AWS4 = 'AWS4'
        const X_AMZ_DATE = 'x-amz-date'
        const X_AMZ_SECURITY_TOKEN = 'x-amz-security-token'
        const HOST = 'host'
        const AUTHORIZATION = 'Authorization'

        function hash(value: string) {
            return SHA256(value) // eslint-disable-line
        }

        function hexEncode(value: WordArray | string) {
            return value.toString(encHex)
        }

        function hmac(secret: WordArray | string, value: WordArray | string) {
            return HmacSHA256(value, secret) // eslint-disable-line
        }

        function buildCanonicalRequest(
            method: Method,
            path: string,
            queryParams: any,
            headers: any,
            payload: string
        ) {
            return (
                method +
                '\n' +
                buildCanonicalUri(path) +
                '\n' +
                buildCanonicalQueryString(queryParams) +
                '\n' +
                buildCanonicalHeaders(headers) +
                '\n' +
                buildCanonicalSignedHeaders(headers) +
                '\n' +
                hexEncode(hash(payload))
            )
        }

        function hashCanonicalRequest(request: string) {
            return hexEncode(hash(request))
        }

        function buildCanonicalUri(uri: string) {
            return encodeURI(uri)
        }

        function buildCanonicalQueryString(queryParams: any) {
            if (Object.keys(queryParams).length < 1) {
                return ''
            }

            const sortedQueryParams = []
            for (const property in queryParams) {
                if (
                    Object.prototype.hasOwnProperty.call(queryParams, property)
                ) {
                    sortedQueryParams.push(property)
                }
            }
            sortedQueryParams.sort()

            let canonicalQueryString = ''
            for (const sortedQueryParam of sortedQueryParams) {
                canonicalQueryString +=
                    sortedQueryParam +
                    '=' +
                    fixedEncodeURIComponent(queryParams[sortedQueryParam]) +
                    '&'
            }
            return canonicalQueryString.substr(
                0,
                canonicalQueryString.length - 1
            )
        }

        function fixedEncodeURIComponent(str: string): string {
            return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
                return '%' + c.charCodeAt(0).toString(16)
            })
        }

        function buildCanonicalHeaders(headers: { [key: string]: object }) {
            let canonicalHeaders = ''
            const sortedKeys = []
            for (const property in headers) {
                if (Object.prototype.hasOwnProperty.call(headers, property)) {
                    sortedKeys.push(property)
                }
            }
            sortedKeys.sort((a, b) =>
                a.toLowerCase().localeCompare(b.toLowerCase())
            )

            for (const key of sortedKeys) {
                canonicalHeaders +=
                    key.toLowerCase() + ':' + headers[key] + '\n'
            }
            return canonicalHeaders
        }

        function buildCanonicalSignedHeaders(headers: any) {
            const sortedKeys = []
            for (const property in headers) {
                if (Object.prototype.hasOwnProperty.call(headers, property)) {
                    sortedKeys.push(property.toLowerCase())
                }
            }
            sortedKeys.sort()

            return sortedKeys.join(';')
        }

        function buildStringToSign(
            datetime: string,
            credentialScope: string,
            hashedCanonicalRequest: string
        ) {
            return (
                AWS_SHA_256 +
                '\n' +
                datetime +
                '\n' +
                credentialScope +
                '\n' +
                hashedCanonicalRequest
            )
        }

        function buildCredentialScope(
            datetime: string,
            region: string,
            service: string
        ) {
            return (
                datetime.substr(0, 8) +
                '/' +
                region +
                '/' +
                service +
                '/' +
                AWS4_REQUEST
            )
        }

        function calculateSigningKey(
            secretKey: string,
            datetime: string,
            region: string,
            service: string
        ) {
            return hmac(
                hmac(
                    hmac(hmac(AWS4 + secretKey, datetime.substr(0, 8)), region),
                    service
                ),
                AWS4_REQUEST
            )
        }

        function calculateSignature(key: any, stringToSign: string) {
            return hexEncode(hmac(key, stringToSign))
        }

        function buildAuthorizationHeader(
            accessKey: string,
            credentialScope: string,
            headers: any,
            signature: string
        ) {
            return (
                AWS_SHA_256 +
                ' Credential=' +
                accessKey +
                '/' +
                credentialScope +
                ', SignedHeaders=' +
                buildCanonicalSignedHeaders(headers) +
                ', Signature=' +
                signature
            )
        }

        if (config.accessKey === undefined || config.secretKey === undefined) {
            return {} as awsSigV4Client
        }

        return {
            accessKey: utils.assertDefined(config.accessKey, 'accessKey'),
            secretKey: utils.assertDefined(config.secretKey, 'secretKey'),
            sessionToken: config.sessionToken,
            serviceName: utils.assertDefined(config.serviceName, 'serviceName'),
            region: utils.assertDefined(config.region, 'region'),
            endpoint: utils.assertDefined(config.endpoint, 'endpoint'),
            retries: config.retries,
            retryCondition: config.retryCondition,
            retryDelay: config.retryDelay,
            host: config.host,
            makeRequest: function (request: awsSigV4ClientRequest) {
                const verb = utils.assertDefined(request.verb, 'verb')
                const path = utils.assertDefined(request.path, 'path')
                let queryParams = utils.copy(request.queryParams)
                let timeout = utils.copy(request.timeout)

                if (queryParams === undefined) {
                    queryParams = {}
                }

                if (timeout === undefined) {
                    timeout = 0
                }
                let headers = utils.copy(request.headers)
                if (headers === undefined) {
                    headers = {}
                }

                // If the user has not specified an override for Content type the use default
                if (headers['Content-Type'] === undefined) {
                    headers['Content-Type'] = config.defaultContentType
                }

                // If the user has not specified an override for Accept type the use default
                if (headers['Accept'] === undefined) {
                    headers['Accept'] = config.defaultAcceptType
                }

                let body = utils.copy(request.body)

                // stringify request body if content type is JSON
                if (
                    body &&
                    headers['Content-Type'] &&
                    headers['Content-Type'] === 'application/json'
                ) {
                    body = JSON.stringify(body)
                }

                // If there is no body remove the content-type header so it is not included in SigV4 calculation
                if (body === '' || body === undefined || body === null) {
                    delete headers['Content-Type']
                }

                const datetime = new Date(
                    new Date().getTime() + config.systemClockOffset
                )
                    .toISOString()
                    .replace(/\.\d{3}Z$/, 'Z')
                    .replace(/[:-]|\.\d{3}/g, '')
                headers[X_AMZ_DATE] = datetime

                if (this.host) {
                    headers[HOST] = this.host
                } else {
                    const parser = urlParser.parse(this.endpoint)
                    headers[HOST] = parser.hostname
                }

                let canonicalRequest = buildCanonicalRequest(
                    verb,
                    path,
                    queryParams,
                    headers,
                    body
                )
                const hashedCanonicalRequest =
                    hashCanonicalRequest(canonicalRequest)
                const credentialScope = buildCredentialScope(
                    datetime,
                    this.region,
                    this.serviceName
                )
                const stringToSign = buildStringToSign(
                    datetime,
                    credentialScope,
                    hashedCanonicalRequest
                )
                const signingKey = calculateSigningKey(
                    this.secretKey,
                    datetime,
                    this.region,
                    this.serviceName
                )
                const signature = calculateSignature(signingKey, stringToSign)
                headers[AUTHORIZATION] = buildAuthorizationHeader(
                    this.accessKey,
                    credentialScope,
                    headers,
                    signature
                )
                if (
                    this.sessionToken !== undefined &&
                    this.sessionToken !== ''
                ) {
                    headers[X_AMZ_SECURITY_TOKEN] = this.sessionToken
                }
                delete headers[HOST]

                let url = config.endpoint + path
                const queryString = buildCanonicalQueryString(queryParams)
                if (queryString !== '') {
                    url += '?' + queryString
                }

                // Need to re-attach Content-Type if it is not specified at this point
                if (headers['Content-Type'] === undefined) {
                    headers['Content-Type'] = config.defaultContentType
                }

                const signedRequest: AxiosRequestConfig = {
                    headers: headers,
                    timeout: timeout,
                    data: body,
                    method: verb,
                    url,
                }
                if (config.retries !== undefined) {
                    signedRequest.baseURL = url
                    const client = axios.create(signedRequest)

                    // Allow user configurable delay, or built-in exponential delay
                    let retryDelay: (retryNumber: number) => number = () => 0
                    if (config.retryDelay === 'exponential') {
                        retryDelay = axiosRetry.exponentialDelay
                    } else if (typeof config.retryDelay === 'number') {
                        retryDelay = () => config.retryDelay as number
                    } else if (typeof config.retryDelay === 'function') {
                        retryDelay = config.retryDelay
                    }

                    axiosRetry(client, {
                        ...config,
                        retryCondition: config.retryCondition,
                        retryDelay,
                    })
                    return client.request(signedRequest)
                }

                return axios(signedRequest)
            },
        }
        /*
    if (config.accessKey === undefined || config.secretKey === undefined) {
      return new awsSigV4Client();
    }
    return new awsSigV4Client();
    */
    }
}

export default sigV4ClientFactory
