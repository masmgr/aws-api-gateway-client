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

const utils = {
  assertDefined: function (object: any, name: any) {
    if (object === undefined) {
      throw new Error(`${name} must be defined`);
    } else {
      return object;
    }
  },
  assertParametersDefined: function (params: any, keys: any, ignore: any) {
    if (keys === undefined) {
      return;
    }
    if (keys.length > 0 && params === undefined) {
      params = {};
    }
    for (let key of keys) {
      if (!utils.contains(ignore, key)) {
        utils.assertDefined(params[key], key);
      }
    }
  },
  parseParametersToObject: function (params: any, keys: any) {
    if (params === undefined) {
      return {};
    }
    let object: any = {};
    for (let key of keys) {
      object[key] = params[key];
    }
    return object;
  },
  contains: function (a: any, obj: any) {
    if (a === undefined) {
      return false;
    }
    let i = a.length;
    while (i--) {
      if (a[i] === obj) {
        return true;
      }
    }
    return false;
  },
  copy: function (obj: any) {
    if (null === obj || "object" !== typeof obj) return obj;
    let Buffer = require("buffer").Buffer;
    if (Buffer.isBuffer(obj)) return Buffer.from(obj);
    let copy = obj.constructor();
    let attr = null;
    for (attr in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, attr))
        copy[attr] = obj[attr];
    }
    return copy;
  },
  mergeInto: function (baseObj: any, additionalProps: any) {
    if (null === baseObj || "object" !== typeof baseObj) return baseObj;
    let merged = baseObj.constructor();
    let attr = null;
    for (attr in baseObj) {
      if (Object.prototype.hasOwnProperty.call(baseObj, attr))
        merged[attr] = baseObj[attr];
    }
    if (null == additionalProps || "object" != typeof additionalProps)
      return baseObj;
    for (attr in additionalProps) {
      if (Object.prototype.hasOwnProperty.call(additionalProps, attr)) {
        merged[attr] = additionalProps[attr];
      }
    }
    return merged;
  },
};

export default utils;
