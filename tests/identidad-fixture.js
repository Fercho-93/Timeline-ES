// Solo para las pruebas: arrancan después de la bienvenida, con una identidad ya
// elegida, igual que arrancan después del acceso. La bienvenida se prueba aparte en
// tests/identidad.mjs, que no carga este archivo.
try {
  if (!localStorage.getItem("continuum-identidad-v1")) localStorage.setItem("continuum-identidad-v1", JSON.stringify({ nombre: "Prueba", avatar: "brujula" }));
} catch { /* sin almacenamiento, la prueba verá la bienvenida */ }
