import * as React from 'react'

/**
 * Movimento reduzido: preferência do sistema **ou** o modo estático `?static=1`
 * que o projeto já usa para captura de tela e apresentação.
 *
 * Quando ativo, a página desliga travel, inércia do arraste, parallax e springs,
 * e troca tudo por fade curto. Não é "animação mais fraca": é outro caminho.
 *
 * O nome começa com `use` porque a regra de hooks do ESLint exige — daí o
 * híbrido com o resto do código em português.
 */
export function useMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = React.useState(false)

  React.useEffect(() => {
    const estatico = new URLSearchParams(window.location.search).has('static')
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)')
    const aplicar = () => setReduzido(estatico || consulta.matches)
    aplicar()
    consulta.addEventListener('change', aplicar)
    return () => consulta.removeEventListener('change', aplicar)
  }, [])

  return reduzido
}
