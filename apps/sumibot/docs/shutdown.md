# Cierre

Una sola función termina el proceso. La primera llamada ejecuta los pasos una
vez y fija el código de salida. Una llamada posterior no hace nada.

- `SIGINT` y `SIGTERM` la llaman con el código 0.
- Cuando el transporte da la sesión de WhatsApp por terminada, la llama con el
  código 1, para que un supervisor de procesos como PM2 inicie uno nuevo.

Los pasos van en este orden: dejar de recibir mensajes, cerrar la API de envío y
desconectar el transporte. Un paso que falla se registra y los demás siguen. El
proceso sale cuando los pasos terminan, o a los 15 segundos si alguno no
termina.

El código está en [lifecycle.ts](../src/bootstrap/lifecycle.ts).
