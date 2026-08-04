

# Playwright SingleFile

Una biblioteca para Node.js que integra la funcionalidad de [SingleFile](https://github.com/gildas-lormeau/SingleFile) con Playwright para guardar páginas web completas como archivos HTML únicos. Este paquete te permite capturar instantáneas de páginas completas, incluyendo CSS, imágenes y otros recursos incrustados directamente en el archivo HTML.

## Instalación

```bashc
pnpm add playwright-single-file
```

## Requisitos

- Node.js 20 o superior
- Playwright ^1.48.0 (dependencia peer)

## Uso

```typescript
import { chromium } from 'playwright'
import { pageToSingleFile } from 'playwright-single-file'

// Uso básico
async function savePage(page) {
  const pageData = await pageToSingleFile(page, {
    removeScripts: true,
    compressHTML: false,
    removeHidden: false,
  })

  // pageData.content contiene la cadena HTML
  // pageData.stats contiene estadísticas de procesamiento
  await fs.writeFile('output.html', pageData.content)
}

// Uso avanzado con manejo de scripts
async function savePageWithScripts(page) {
  const pageData = await pageToSingleFile(page, {
    removeScripts: false, // Mantener JavaScript
    blockScripts: false, // No bloquear la ejecución de scripts
  })

  // Las estadísticas mostrarán los recursos procesados vs descartados
  console.log('Stats:', pageData.stats)
  // {
  //   processed: { scripts: number, ... },
  //   discarded: { scripts: number, ... }
  // }
}
```

### Opciones

- `removeScripts`: Eliminar JavaScript de la página (predeterminado: false)
- `blockScripts`: Bloquear la ejecución de scripts (predeterminado: false)
- `compressHTML`: Comprimir el HTML de salida (predeterminado: false)
- `removeHidden`: Eliminar elementos ocultos (predeterminado: false)
- `removeEmptyLines`: Eliminar líneas vacías de la salida (predeterminado: false)

## Características

- Captura páginas web completas como archivos HTML únicos
- Incrusta CSS, imágenes y otros recursos
- Manejo de scripts configurable (eliminar/mantener/bloquear)
- Estadísticas de procesamiento detalladas
- Compatible con las capacidades de automatización de Playwright
- Soporte para TypeScript

## Desarrollo

```bash
# Instalar dependencias
pnpm install

# Construir el proyecto
pnpm build

# Ejecutar pruebas
pnpm test

# Ejecutar pruebas con interfaz gráfica (UI)
pnpm test:ui

# Ejecutar pruebas en modo de depuración
pnpm test:debug
```

## Hecho posible por

- [SingleFile](https://github.com/gildas-lormeau/SingleFile)
- [SingleFile CLI](https://github.com/gildas-lormeau/single-file-cli)
- [single-file-core](https://github.com/gildas-lormeau/single-file-core)

## Licencia

SingleFile y SingleFile CLI tienen licencia AGPL. El código derivado de proyectos de terceros tiene licencia MIT. Contacta a gildas.lormeau &lt;at&gt; gmail.com si estás interesado en obtener una licencia del código de SingleFile para un servicio o producto comercial.
