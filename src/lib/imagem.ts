/**
 * Compressão de imagem no cliente antes de virar data URL. Uma foto de celular
 * tem 3–8 MB; sem redimensionar/recomprimir, isso estoura a quota do
 * localStorage (protótipo) e incha o payload jsonb no banco (a data URL é
 * gravada inline em colunas como `checkins.fotos` e `alunos.anamnese_respostas`).
 * Se algo falhar (canvas indisponível), cai no data URL original.
 */
export async function comprimirImagem(
  file: File,
  maxLado = 1280,
  qualidade = 0.8
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("imagem inválida"));
      im.src = dataUrl;
    });
    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * escala));
    const h = Math.max(1, Math.round(img.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", qualidade);
  } catch {
    return dataUrl;
  }
}
