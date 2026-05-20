const https = require("https");

function testApi(payload) {
  return new Promise((resolve) => {
    const req = https.request("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer 123456789.123456789"
      }
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve({ status: res.statusCode, data }));
    });
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function run() {
  console.log("Testing with array and no system prompt...");
  let res = await testApi({
    model: "glm-4v-flash",
    messages: [
      { role: "user", content: [
        { type: "text", text: "What is this?" }
      ]}
    ]
  });
  console.log(res);

  console.log("Testing with text only...");
  res = await testApi({
    model: "glm-4v-flash",
    messages: [
      { role: "user", content: "What is this?" }
    ]
  });
  console.log(res);
}

run();
