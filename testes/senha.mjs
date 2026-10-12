import assert from 'node:assert/strict'
import { validarSenha } from '../src/lib/senha.js'

assert.ok(validarSenha('abc123'), 'curta demais')
assert.ok(validarSenha('abcdefg1'.slice(0, 7)), '7 caracteres')
assert.ok(validarSenha('abcdefgh'), 'só letras')
assert.ok(validarSenha('12345678'), 'só números')
assert.ok(validarSenha('        '), 'só espaços')
assert.equal(validarSenha('abcdefg1'), null, '8 com letra e número')
assert.equal(validarSenha('Senha2026'), null)
assert.equal(validarSenha('açúcar123'), null, 'letra acentuada conta')
console.log('senha: ok')
