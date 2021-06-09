/* eslint arrow-parens: off */
import test from "ava";
import apigClientFactory, {
  apigClientFactoryConfig,
} from "../src/apigClient.js";

// TEST CONFIG -- TODO fill in with "real" testable values
const config: apigClientFactoryConfig = {
  invokeUrl: "https://0000000000.execute-api.us-east-1.amazonaws.com",
  region: "us-east-1",
  accessKey: "00000000000000000000",
  secretKey: "0000000000000000000000000000000000000000",
  apiKey: "0000000000000000000000000000000000000000",
  retries: 4,
  retryCondition: (err: any) => {
    return err.response.status === 500;
  },
} as apigClientFactoryConfig;

test("apigClientFactory exists", (t) => {
  t.deepEqual(typeof apigClientFactory, "function");
  t.deepEqual(typeof apigClientFactory.newClient, "function");
});

test("apigClientFactory creates client", (t) => {
  const client = apigClientFactory.newClient(config);
  t.deepEqual(typeof client, "object");
});

// IF we make a public test API endpoint, we can do a real request and response here...
//   (I did this for my own, non-public endpoint, but have not built a TEST one @alan)
// test('apigClient works', async t => {
//   const additionalParams = {};
//   const body = {};
//   const path = '/mytest/path';
//   const prom = await apigClient.invokeApi({}, path, 'POST', additionalParams, body);
//   t.deepEqual(typeof prom, 'object');
//   t.deepEqual(prom.result, 'myresposne');
// });
