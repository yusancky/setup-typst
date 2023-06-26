const core = require('@actions/core');
const { exec } = require('child_process');
const fs = require("fs");
const fetch = require('node-fetch');
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit();
const os = require("os");
const semverSatisfies = require('semver/functions/satisfies')

function runBash(command) {
    return new Promise((resolve, reject) => {
        exec(command, { shell: true }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            console.log(`Command output: ${command}`);
            console.log(stdout);
            resolve(stdout.trim());
        });
    });
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
            response.body.on('error', (err) => {
                reject(err);
            });
            fileStream.on('finish', function () {
                resolve();
            });
        });
    } else {
        console.error('Failed to download file:', response.status, response.statusText);
    }
}

async function main() {
    const token = core.getInput('token');
    const version = core.getInput('version');

    const owner = "typst";
    const repo = "typst";
    let assetName;
    if (os.platform() === "linux") {
        assetName = semverSatisfies(version, '>=0.3.0') ? "typst-x86_64-unknown-linux-musl.tar.xz" : "typst-x86_64-unknown-linux-gnu.tar.gz";
    } else if (os.platform() === "win32") {
        assetName = "typst-x86_64-pc-windows-msvc.zip";
    } else {
        assetName = semverSatisfies(version, '>=0.3.0') ? "typst-x86_64-apple-darwin.tar.xz" : "typst-x86_64-apple-darwin.tar.gz";
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

    downloadFromUrl(asset.browser_download_url, assetName, token).catch((error) => {
        console.error('Error occurred while downloading file:', error);
    });

    runBash(os.platform() === "win32" ? `7z x ${assetName} -oc:\\typst` : `sudo tar -xzf ${assetName} -C /usr/local/typst/`);

    runBash(`rm -f ${assetName}`)

    runBash(os.platform() === "win32" ? `echo "c:\\typst\\${assetName}" >> $GITHUB_PATH` : `echo "/usr/local/typst/${assetName}" >> $GITHUB_PATH`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
