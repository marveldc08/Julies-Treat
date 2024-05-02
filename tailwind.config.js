/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,css,scss,min}"],
  theme: {
    extend: {
      colors: {
        primary: "#EAA636",
        secondary: "#545454",
        light: "#FDF5EB",
        dark: "#1E1916",
        minor: "#AC208C",
      },
    },
  },
  plugins: [],
};

