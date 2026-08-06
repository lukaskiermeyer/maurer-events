const https = require('https');
const fs = require('fs');

const file = fs.createWriteStream("public/fonts/Roboto-Regular.ttf");
https.get("https://github.com/google/fonts/raw/main/apache/roboto/Roboto-Regular.ttf", function(response) {
  if (response.statusCode === 302) {
    https.get(response.headers.location, function(redirectResponse) {
      redirectResponse.pipe(file);
      file.on("finish", () => {
        file.close();
        console.log("Download completed");
      });
    });
  } else {
    response.pipe(file);
    file.on("finish", () => {
      file.close();
      console.log("Download completed");
    });
  }
});
