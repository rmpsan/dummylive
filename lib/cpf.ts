/** Utilidades de CPF: normalização, máscara e validação (dígitos). */

export function apenasDigitos(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Aplica a máscara 000.000.000-00 progressivamente. */
export function formatarCPF(v: string): string {
  const d = apenasDigitos(v).slice(0, 11);
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)];
  let out = p[0];
  if (p[1]) out += "." + p[1];
  if (p[2]) out += "." + p[2];
  if (p[3]) out += "-" + p[3];
  return out;
}

/** Valida CPF pelos dígitos verificadores (rejeita sequências repetidas). */
export function cpfValido(v: string): boolean {
  const cpf = apenasDigitos(v);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calc = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += parseInt(base[i], 10) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return d1 === parseInt(cpf[9], 10) && d2 === parseInt(cpf[10], 10);
}
