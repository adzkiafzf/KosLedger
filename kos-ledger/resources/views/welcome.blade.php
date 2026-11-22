
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Laravel + Tailwind</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen bg-gray-100 flex items-center justify-center">

    <div class="bg-white p-10 rounded-2xl shadow-lg text-center">
        <h1 class="text-3xl font-bold text-green-600 mb-3">
            Laravel + Tailwind CSS
        </h1>

        <p class="text-gray-600 mb-5">
            Tailwind CSS berhasil dijalankan!
        </p>

        <button class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg">
            Get Started
        </button>
    </div>

</body>
</html>
