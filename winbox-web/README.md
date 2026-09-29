# Winbox Web

Cliente web tipo Winbox para routers MikroTik (RouterOS **v7.1+**), sin dependencias (solo Node 18+).

> Winbox usa un protocolo propio (puerto 8291) que los navegadores no pueden abrir. Esta app usa la
> **API REST de RouterOS**: el navegador habla con un pequeño servidor Node que reenvía las peticiones al router.

## Uso
1. En el router: `/ip service enable www` (o `www-ssl` con certificado).
2. `npm start` → abre http://localhost:8080 e inicia sesión con IP, usuario y contraseña.

## Variables de entorno
| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | 8080 | Puerto de la web |
| `BIND` | 127.0.0.1 | Interfaz de escucha (`0.0.0.0` para acceder desde otros equipos) |
| `ALLOW_PUBLIC_ROUTERS` | 0 | `1` permite conectar a IPs públicas (por defecto solo LAN, evita SSRF) |

## Funciones
Resumen del sistema, interfaces, bridge, Wi-Fi, IP (direcciones, rutas, DHCP, ARP, DNS), firewall (filter, NAT, address lists,
conexiones), queues, PPP, hotspot, usuarios, log y terminal. Añadir, habilitar/deshabilitar y eliminar desde la tabla.

## Seguridad
Sirve la app solo en localhost o detrás de HTTPS (proxy inverso) con autenticación si la expones: las credenciales del router
se guardan en memoria del servidor durante la sesión (30 min de inactividad).
