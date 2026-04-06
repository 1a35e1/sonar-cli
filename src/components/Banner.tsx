import React from 'react'
import { Text } from 'ink'

const LOGO = `
 _|_|_|    _|_|    _|      _|    _|_|    _|_|_|
_|        _|    _|  _|_|    _|  _|    _|  _|    _|
  _|_|    _|    _|  _|  _|  _|  _|_|_|_|  _|_|_|
      _|  _|    _|  _|    _|_|  _|    _|  _|    _|
_|_|_|      _|_|    _|      _|  _|    _|  _|    _|`.trimStart()

export function Banner() {
  return <Text dimColor>{LOGO}</Text>
}
