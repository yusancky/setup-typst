const core = require("@actions/core");
const fs = require("fs");
const fetch = require("node-fetch");
const tar = require("node-tar");
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit();
const os = require("os");
const semverSatisfies = require("semver/functions/satisfies");
const unzip = require("unzip");

function removeAfterFirstDot(str) {
    const dotIndex = str.indexOf(".");
    if (dotIndex !== -1) {
        return str.substring(0, dotIndex);
    }
    return str;
}

async function downloadFromUrl(downloadUrl, fileName, token) {
    const response = await fetch(downloadUrl, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (response.ok) {
        const fileStream = fs.createWriteStream(fileName);
        await new Promise((resolve, reject) => {
            response.body.pipe(fileStream);
            response.body.on("error", (err) => {
                reject(err);
            });
            fileStream.on("finish", function () {
                resolve();
            });
        });
    } else {
        console.error("Failed to download file:", response.status, response.statusText);
    }
}

async function main() {
    const token = core.getInput("token");
    const version = core.getInput("version");

    const owner = "typst";
    const repo = "typst";
    let assetName;
    if (os.platform() === "linux") {
        assetName = semverSatisfies(version, ">=0.3.0") ? "typst-x86_64-unknown-linux-musl.tar.xz" : "typst-x86_64-unknown-linux-gnu.tar.gz";
    } else if (os.platform() === "win32") {
        assetName = "typst-x86_64-pc-windows-msvc.zip";
    } else {
        assetName = semverSatisfies(version, ">=0.3.0") ? "typst-x86_64-apple-darwin.tar.xz" : "typst-x86_64-apple-darwin.tar.gz";
    }

    const { data: releases } = await octokit.repos.listReleases({
        owner,
        repo,
        auth: token,
    });

    const release = releases.find((release) => release.tag_name === version);

    if (!release) {
        console.log(`Release ${version} not found.`);
        return;
    }

    const asset = release.assets.find((asset) => asset.name === assetName);

    if (!asset) {
        console.log(`Asset ${assetName} not found in release ${version}.`);
        return;
    }

    archiveName = os.platform() === "win32" ? `c:\\${assetName}` : `/usr/local/${assetName}`;
    fileName = os.platform() === "win32" ? `c:\\typst\\${removeAfterFirstDot(assetName)}` : `/usr/local/typst/${removeAfterFirstDot(assetName)}`;

    downloadFromUrl(asset.browser_download_url, archiveName, token).catch((error) => {
        console.error("Error occurred while downloading file:", error);
    });

    if (os.platform() === "win32") {
        fs.createReadStream(archiveName).pipe(unzip.Extract({ path: 'c:\\typst' }));
    } else {
        fs.createReadStream(archiveName).pipe(tar.Extract({ path: '/usr/local/typst' }))
    }

    if (fs.existsSync(archiveName)) {
        fs.unlink(archiveName, function (err) {
            if (err) throw err;
        });
    } else {
        console.log('file not present')
    }

    core.addPath(fileName);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
