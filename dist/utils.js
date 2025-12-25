"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clamp = clamp;
exports.log10 = log10;
exports.median = median;
exports.round = round;
exports.formatSigned = formatSigned;
exports.isDocsPath = isDocsPath;
exports.isInfraPath = isInfraPath;
exports.isCorePath = isCorePath;
exports.isTestsPath = isTestsPath;
exports.isDepsPath = isDepsPath;
function clamp(min, max, v) {
    return Math.max(min, Math.min(max, v));
}
function log10(x) {
    return Math.log(x) / Math.log(10);
}
function median(nums) {
    if (nums.length === 0)
        return null;
    const a = [...nums].sort((x, y) => x - y);
    const mid = Math.floor(a.length / 2);
    if (a.length % 2 === 0)
        return (a[mid - 1] + a[mid]) / 2;
    return a[mid];
}
function round(n) {
    return Math.round(n);
}
function formatSigned(n) {
    if (n > 0)
        return `+${n}`;
    return `${n}`;
}
function isDocsPath(p) {
    const lower = p.toLowerCase();
    if (lower.startsWith("docs/"))
        return true;
    if (lower.endsWith(".md"))
        return true;
    if (lower.startsWith("readme"))
        return true;
    return false;
}
function isInfraPath(p) {
    const lower = p.toLowerCase();
    if (lower.startsWith(".github/"))
        return true;
    if (lower === "dockerfile")
        return true;
    if (lower.startsWith("terraform/"))
        return true;
    if (lower.endsWith(".yml") || lower.endsWith(".yaml"))
        return true;
    if (lower.endsWith(".tf"))
        return true;
    return false;
}
function isCorePath(p) {
    const lower = p.toLowerCase();
    return lower.startsWith("src/") || lower.startsWith("lib/") || lower.startsWith("app/");
}
function isTestsPath(p) {
    const lower = p.toLowerCase();
    return lower.startsWith("tests/") || lower.includes("/__tests__/") || lower.startsWith("__tests__/");
}
function isDepsPath(p) {
    const lower = p.toLowerCase();
    const depsFiles = new Set([
        "package.json",
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "poetry.lock",
        "requirements.txt",
        "pipfile.lock"
    ]);
    return depsFiles.has(lower);
}
