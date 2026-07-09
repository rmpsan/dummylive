/**
 * Coleta metadados do dispositivo do espectador para `session_start`
 * (RF-45). Roda no browser; parsing leve de user-agent, sem dependência.
 */
export interface DeviceInfo {
  dispositivo: string;
  sistema_operacional: string;
  navegador: string;
  resolucao: string;
  timezone: string;
}

export function coletarDeviceInfo(): DeviceInfo {
  if (typeof navigator === "undefined") {
    return {
      dispositivo: "desconhecido",
      sistema_operacional: "desconhecido",
      navegador: "desconhecido",
      resolucao: "",
      timezone: "",
    };
  }

  const ua = navigator.userAgent;

  const dispositivo = /Mobi|Android|iPhone|iPod/i.test(ua)
    ? "mobile"
    : /iPad|Tablet/i.test(ua)
      ? "tablet"
      : "desktop";

  let so = "outro";
  if (/Windows/i.test(ua)) so = "Windows";
  else if (/Android/i.test(ua)) so = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) so = "iOS";
  else if (/Mac OS X/i.test(ua)) so = "macOS";
  else if (/Linux/i.test(ua)) so = "Linux";

  let navegador = "outro";
  if (/Edg\//i.test(ua)) navegador = "Edge";
  else if (/CriOS|Chrome/i.test(ua)) navegador = "Chrome";
  else if (/Firefox/i.test(ua)) navegador = "Firefox";
  else if (/Safari/i.test(ua)) navegador = "Safari";

  return {
    dispositivo,
    sistema_operacional: so,
    navegador,
    resolucao:
      typeof window !== "undefined"
        ? `${window.screen.width}x${window.screen.height}`
        : "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
  };
}
