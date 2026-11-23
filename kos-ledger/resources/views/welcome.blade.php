<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KosLedger</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..24,300..500,0..1,0&display=swap">
  @vite(['resources/css/app.css', 'resources/js/app.js'])
  {{-- Midtrans Snap SDK Integration --}}
  <script
    src="{{ config('midtrans.is_production') ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js' }}"
    data-client-key="{{ config('midtrans.client_key') }}"
  ></script>
  <script>
    window.MIDTRANS_CONFIG = {
      isProduction: {{ config('midtrans.is_production') ? 'true' : 'false' }},
      clientKey: "{{ config('midtrans.client_key') }}"
    };
  </script>
</head>
<body>
  <div id="app"></div>
  <div class="toast" id="toast" role="status"></div>
  <div class="proto" id="proto"></div>
</body>
</html>
