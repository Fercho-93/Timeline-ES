// Solo para las pruebas: arrancan después de la bienvenida y de la pregunta de edad, con una identidad ya
// elegida, igual que arrancan después del acceso. La bienvenida se prueba aparte en
// tests/identidad.mjs, que no carga este archivo.
try {
  if (!localStorage.getItem("continuum-identidad-v1")) localStorage.setItem("continuum-identidad-v1", JSON.stringify({ nombre: "Prueba" }));
  // Y con la edad ya respondida (edad.js), que se prueba en tests/edad.mjs.
  if (!localStorage.getItem("continuum-edad-v1")) localStorage.setItem("continuum-edad-v1", "mayor");
} catch { /* sin almacenamiento, la prueba verá la bienvenida */ }
