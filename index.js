const core = require("@actions/core");
var Zip = require("adm-zip");
const axios = require('axios');
const fs = require("fs");
const os = require("os");
const semverSatisfies = require("semver/functions/satisfies");
const tar = require("tar");

function removeAfterFirstDot(str) {
  const dotIndex = str.indexOf(".");
  if (dotIndex !== -1) {
    return str.substring(0, dotIndex);
  }
  return str;
}

async function downloadFromUrl(downloadUrl, fileName) {
  const response = await axios({
    method: 'get',
    url: downloadUrl,
    responseType: 'stream',
  });

  const fileStream = fs.createWriteStream(fileName);
  response.data.pipe(fileStream);

  return new Promise((resolve, reject) => {
    fileStream.on('finish', () => {
      fileStream.close();
      resolve();
    });

    fileStream.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  const version = core.getInput("version");

  let assetName;
  if (os.platform() === "linux") {
    assetName = semverSatisfies(version, ">=0.3.0") ? "typst-x86_64-unknown-linux-musl.tar.xz" : "typst-x86_64-unknown-linux-gnu.tar.gz";
  } else if (os.platform() === "win32") {
    assetName = "typst-x86_64-pc-windows-msvc.zip";
  } else {
    assetName = semverSatisfies(version, ">=0.3.0") ? "typst-x86_64-apple-darwin.tar.xz" : "typst-x86_64-apple-darwin.tar.gz";
  }
  let archiveName = os.platform() === "win32" ? `C:/${assetName}` : `/usr/local/${assetName}`;
  let fileName = os.platform() === "win32" ? `C:/typst/${removeAfterFirstDot(assetName)}` : `/usr/local/typst/${removeAfterFirstDot(assetName)}`;

  downloadFromUrl(`https://github.com/typst/typst/releases/download/${version}/${assetName}`, archiveName)
    .then(() => {
      console.log('Typst downloaded successfully!');
    })
    .catch((error) => {
      console.error('Failed to download Typst:', error);
    });

  if (os.platform() === "win32") {
    var zip = new Zip(archiveName);
    zip.extractAllTo('C:/typst');
  } else {
    fs.createReadStream(archiveName).pipe(tar.x({ path: '/usr/local/typst' }))
  }

  if (fs.existsSync(archiveName)) {
    fs.unlink(archiveName, function (err) {
      if (err) throw err;
    });
  }

  core.addPath(fileName);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
