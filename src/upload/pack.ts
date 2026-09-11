/** Uncompressed (store) ZIP so the sample pack does not need a binary fixture. */

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (c ^ 0xffffffff) >>> 0
}

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff])
}

function u32(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff])
}

function concat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(len)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export interface ZipEntry {
  path: string
  bytes: Uint8Array
}

/** Build a store-method zip (no compression). */
export function writeZip(entries: ZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  const encoder = new TextEncoder()

  for (const entry of entries) {
    const name = encoder.encode(entry.path)
    const crc = crc32(entry.bytes)
    const local = concat([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(entry.bytes.length),
      u32(entry.bytes.length),
      u16(name.length),
      u16(0),
      name,
      entry.bytes,
    ])
    const central = concat([
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(entry.bytes.length),
      u32(entry.bytes.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }

  const centralDir = concat(centrals)
  const eocd = concat([
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ])
  return concat([...locals, centralDir, eocd])
}

function viewAt(buf: Uint8Array, i: number) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  return {
    u16: (o: number) => dv.getUint16(i + o, true),
    u32: (o: number) => dv.getUint32(i + o, true),
  }
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This zip is compressed and this browser cannot inflate it. Try an HTML file.')
  }
  const ds = new DecompressionStream('deflate-raw')
  const stream = new Blob([asArrayBuffer(data)]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function findEocd(buf: Uint8Array): number {
  const sig = 0x06054b50
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const max = Math.min(buf.length - 22, 0xffff)
  for (let i = buf.length - 22; i >= buf.length - 22 - max && i >= 0; i--) {
    if (dv.getUint32(i, true) === sig) return i
  }
  throw new Error('Not a zip file (missing central directory).')
}

/**
 * Read a zip of static pages. Skips macOS junk. Inflates deflate entries when
 * DecompressionStream is available.
 */
export async function readZip(buf: Uint8Array): Promise<ZipEntry[]> {
  const eocd = findEocd(buf)
  const n = viewAt(buf, eocd).u16(10)
  const cdOffset = viewAt(buf, eocd).u32(16)
  const decoder = new TextDecoder()
  const out: ZipEntry[] = []
  let cursor = cdOffset

  for (let i = 0; i < n; i++) {
    const rec = viewAt(buf, cursor)
    if (rec.u32(0) !== 0x02014b50) throw new Error('Zip central directory is damaged.')
    const method = rec.u16(10)
    const compSize = rec.u32(20)
    const nameLen = rec.u16(28)
    const extraLen = rec.u16(30)
    const commentLen = rec.u16(32)
    const localOff = rec.u32(42)
    const name = decoder.decode(buf.slice(cursor + 46, cursor + 46 + nameLen))
    cursor += 46 + nameLen + extraLen + commentLen

    const base = name.split('/').pop() ?? name
    if (!base || base.startsWith('.') || name.startsWith('__MACOSX')) continue

    const local = viewAt(buf, localOff)
    const localNameLen = local.u16(26)
    const localExtra = local.u16(28)
    const dataStart = localOff + 30 + localNameLen + localExtra
    const compressed = buf.slice(dataStart, dataStart + compSize)
    let bytes: Uint8Array
    if (method === 0) bytes = compressed
    else if (method === 8) bytes = await inflateRaw(compressed)
    else throw new Error(`Unsupported zip compression (${method}) in ${name}.`)
    out.push({ path: name.replace(/^\/+/, ''), bytes })
  }
  return out
}

export function zipToBlob(bytes: Uint8Array): Blob {
  return new Blob([asArrayBuffer(bytes)], { type: 'application/zip' })
}
