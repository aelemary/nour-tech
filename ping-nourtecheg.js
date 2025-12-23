#!/usr/bin/env node
"use strict";

const http = require("http");
const https = require("https");

const DEFAULT_URL = "https://nourtecheg.com";
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10 * 1000;
const MAX_REDIRECTS = 3;

const targetRaw = process.env.PING_URL || DEFAULT_URL;
const intervalMs = Number(process.env.PING_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
const timeoutMs = Number(process.env.PING_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

function normalizeUrl(input) {
  if (/^https?:\/\//i.test(input)) {
    return new URL(input);
  }
  return new URL(`https://${input}`);
}

function requestUrl(url, redirectsLeft) {
  const lib = url.protocol === "https:" ? https : http;
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          "User-Agent": "nour-tech-ping/1.0",
          Accept: "*/*",
        },
      },
      (res) => {
        const durationMs = Date.now() - startedAt;
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          const nextUrl = new URL(res.headers.location, url);
          res.resume();
          resolve(requestUrl(nextUrl, redirectsLeft - 1));
          return;
        }
        res.resume();
        resolve({
          statusCode: res.statusCode,
          durationMs,
          finalUrl: url.toString(),
        });
      }
    );

    req.on("error", (error) => {
      reject({
        error,
        durationMs: Date.now() - startedAt,
        finalUrl: url.toString(),
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.end();
  });
}

async function pingOnce() {
  const now = new Date().toISOString();
  try {
    const result = await requestUrl(normalizeUrl(targetRaw), MAX_REDIRECTS);
    console.log(
      `[${now}] PING ${result.finalUrl} -> ${result.statusCode} (${result.durationMs}ms)`
    );
  } catch (err) {
    const message = err && err.error ? err.error.message : "Unknown error";
    const durationMs = err && err.durationMs ? err.durationMs : 0;
    const finalUrl = err && err.finalUrl ? err.finalUrl : targetRaw;
    console.log(`[${now}] PING ${finalUrl} -> ERROR ${message} (${durationMs}ms)`);
  }
}

console.log(
  `Ping service started for ${normalizeUrl(targetRaw)} every ${Math.round(
    intervalMs / 1000
  )}s`
);
pingOnce();
setInterval(pingOnce, intervalMs);
