<?php
// Reference-backend til Tegneserie-dashboard.
// GET  -> returnerer data.json (hele datasættet)
// POST -> skriver request-body (JSON-array) til data.json
// Kræver api-secret.txt (én linje med token) — enten i samme mappe (beskyt så filen via .htaccess)
// eller, bedre, én mappe OVER web-roden (så den aldrig kan hentes via HTTP).
// Hvis api-secret.txt mangler, afvises alle kald (sikkert default).
header('Content-Type: application/json; charset=utf-8');

$dir = __DIR__;
$secretFile = is_file($dir . '/api-secret.txt') ? $dir . '/api-secret.txt' : $dir . '/../api-secret.txt';
$dataFile = $dir . '/data.json';

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

if (!is_file($secretFile)) {
    fail(403, 'api-secret.txt mangler — opret den med et token (i samme mappe eller én mappe over web-roden)');
}
$secret = trim(file_get_contents($secretFile));
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (!hash_equals('Bearer ' . $secret, $auth)) {
    fail(403, 'unauthorized');
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    if (!is_file($dataFile)) {
        fail(404, 'data.json findes ikke — kør scripts/export_json.py først');
    }
    echo file_get_contents($dataFile);
    exit;
}
if ($method !== 'POST') {
    fail(405, 'kun GET/POST understøttet');
}

$body = file_get_contents('php://input');
$data = json_decode($body, true);
if (!is_array($data)) {
    fail(400, 'ugyldig JSON');
}
$tmp = $dir . '/data.json.tmp';
if (file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) === false) {
    fail(500, 'kunne ikke skrive data.json.tmp');
}
if (!rename($tmp, $dataFile)) {
    fail(500, 'kunne ikke erstatte data.json');
}
echo json_encode(['ok' => true, 'count' => count($data)]);
