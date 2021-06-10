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

export type Header = any
export type QueryParams = any
export type Body = any

class utils {
    static assertDefined<T>(object: T | undefined, name: string): T {
        if (object === undefined) {
            throw new Error(`${name} must be defined`)
        } else {
            return object
        }
    }
    static assertParametersDefined(
        params: any,
        keys: string[],
        ignore: string[]
    ) {
        if (keys === undefined) {
            return
        }
        if (keys.length > 0 && params === undefined) {
            params = {}
        }
        for (const key of keys) {
            if (!utils.contains(ignore, key)) {
                utils.assertDefined(params[key], key)
            }
        }
    }
    static parseParametersToObject(
        params: { [key: string]: any },
        keys: string[]
    ) {
        if (params === undefined) {
            return {}
        }
        const object: any = {}
        for (const key of keys) {
            object[key] = params[key]
        }
        return object
    }
    static contains(a: any, obj: any): boolean {
        if (a === undefined) {
            return false
        }
        let i = a.length
        while (i--) {
            if (a[i] === obj) {
                return true
            }
        }
        return false
    }
    static copy(obj: any): any {
        if (null === obj || 'object' !== typeof obj) return obj
        const Buffer = require('buffer').Buffer
        if (Buffer.isBuffer(obj)) return Buffer.from(obj)
        const copy = obj.constructor()
        for (const attr in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, attr))
                copy[attr] = obj[attr]
        }
        return copy
    }
    static mergeInto(baseObj: any, additionalProps: any) {
        if (null === baseObj || 'object' !== typeof baseObj) return baseObj
        const merged = baseObj.constructor()
        for (const attr in baseObj) {
            if (Object.prototype.hasOwnProperty.call(baseObj, attr))
                merged[attr] = baseObj[attr]
        }
        if (null == additionalProps || 'object' != typeof additionalProps)
            return baseObj
        for (const attr in additionalProps) {
            if (Object.prototype.hasOwnProperty.call(additionalProps, attr)) {
                merged[attr] = additionalProps[attr]
            }
        }
        return merged
    }
}

export default utils
