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
  console.log("Testing text with system prompt...");
  let res = await testApi({
    model: "glm-4.6v-flash",
    messages: [
      { role: "system", content: "system" },
      { role: "user", content: "user" }
    ],
    temperature: 0.2
  });
  console.log(res);

  console.log("Testing image with system prompt...");
  res = await testApi({
    model: "glm-4.6v-flash",
    messages: [
      { role: "system", content: "system" },
      { role: "user", content: [
        { type: "image_url", image_url: { url: "https://example.com/a.jpg" } },
        { type: "text", text: "text" }
      ]}
    ],
    temperature: 0.2
  });
  console.log(res);

  console.log("Testing without system prompt...");
  res = await testApi({
    model: "glm-4.6v-flash",
    messages: [
      { role: "user", content: "user" }
    ]
  });
  console.log(res);
}

run();
