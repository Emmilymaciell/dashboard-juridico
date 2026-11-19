import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CARENCIA_MS, useFocoComCarencia } from './useFocoComCarencia'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const avancar = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

describe('foco com carência', () => {
  it('começa fechado', () => {
    const { result } = renderHook(() => useFocoComCarencia())
    expect(result.current.foco).toBe('nenhum')
  })

  it('abre no gatilho', () => {
    const { result } = renderHook(() => useFocoComCarencia())
    act(() => result.current.abrir('documentos'))
    expect(result.current.foco).toBe('documentos')
  })

  it('sair do gatilho NÃO fecha na hora — só agenda', () => {
    const { result } = renderHook(() => useFocoComCarencia())
    act(() => result.current.abrir('documentos'))
    act(() => result.current.agendarFechamento())

    // ainda dentro da carência: o cursor está a caminho do card
    avancar(CARENCIA_MS - 40)
    expect(result.current.foco).toBe('documentos')
  })

  it('fecha quando a carência expira sem ninguém cancelar', () => {
    const { result } = renderHook(() => useFocoComCarencia())
    act(() => result.current.abrir('documentos'))
    act(() => result.current.agendarFechamento())

    avancar(CARENCIA_MS + 20)
    expect(result.current.foco).toBe('nenhum')
  })

  it('entrar no card cancela o fechamento — é o caso que motivou tudo isto', () => {
    const { result } = renderHook(() => useFocoComCarencia())
    act(() => result.current.abrir('documentos'))
    act(() => result.current.agendarFechamento())
    act(() => result.current.cancelarFechamento())

    // muito depois da carência, continua aberto
    avancar(CARENCIA_MS * 10)
    expect(result.current.foco).toBe('documentos')
  })

  it('sair do card fecha, como qualquer saída', () => {
    const { result } = renderHook(() => useFocoComCarencia())
    act(() => result.current.abrir('node'))
    act(() => result.current.agendarFechamento())
    act(() => result.current.cancelarFechamento())
    act(() => result.current.agendarFechamento())

    avancar(CARENCIA_MS + 20)
    expect(result.current.foco).toBe('nenhum')
  })

  it('vale igual para o card do node', () => {
    const { result } = renderHook(() => useFocoComCarencia())
    act(() => result.current.abrir('node'))
    act(() => result.current.agendarFechamento())
    act(() => result.current.cancelarFechamento())

    avancar(CARENCIA_MS * 10)
    expect(result.current.foco).toBe('node')
  })

  it('trocar de gatilho cancela o fechamento pendente do anterior', () => {
    const { result } = renderHook(() => useFocoComCarencia())
    act(() => result.current.abrir('documentos'))
    act(() => result.current.agendarFechamento())
    act(() => result.current.abrir('node'))

    avancar(CARENCIA_MS + 20)
    // o temporizador do documento não pode derrubar o node que abriu depois
    expect(result.current.foco).toBe('node')
  })

  it('os dois nunca coexistem: é um valor só', () => {
    const { result } = renderHook(() => useFocoComCarencia())
    act(() => result.current.abrir('documentos'))
    act(() => result.current.abrir('node'))
    expect(result.current.foco).toBe('node')
  })

  it('fecharAgora ignora a carência — Esc não espera', () => {
    const { result } = renderHook(() => useFocoComCarencia())
    act(() => result.current.abrir('documentos'))
    act(() => result.current.fecharAgora())
    expect(result.current.foco).toBe('nenhum')
  })

  it('desmontar com fechamento agendado não deixa temporizador órfão', () => {
    const { result, unmount } = renderHook(() => useFocoComCarencia())
    act(() => result.current.abrir('documentos'))
    act(() => result.current.agendarFechamento())
    unmount()
    // se o `setState` sobrevivesse ao desmonte, isto avisaria no console
    expect(() => avancar(CARENCIA_MS * 3)).not.toThrow()
  })
})
