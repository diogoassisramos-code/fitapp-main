import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  // Permite acessar o dev server por outra origem (ex.: o túnel do ngrok, ou o
  // celular na mesma rede) sem o Next barrar as requisições cross-origin de dev
  // (HMR/RSC). Só afeta `npm run dev`; em produção não tem efeito.
  // OBS: se reiniciar o ngrok e o subdomínio mudar, atualize o host abaixo.
  allowedDevOrigins: [
    "revolver-swear-deviation.ngrok-free.dev",
    ".ngrok-free.dev",
    ".ngrok-free.app",
  ],
};

export default nextConfig;
