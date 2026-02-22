import type { CodegenConfig } from '@graphql-codegen/cli'

// https://the-guild.dev/graphql/codegen/plugins/typescript/typescript-graphql-request
const config: CodegenConfig = {
  overwrite: true,
  schema: 'https://api.sonar.8640p.info/graphql',
  documents: ['src/**/*'],
  hooks: {
    afterAllFileWrite: ['pnpm biome check --write src/types/sonar.ts --linter-enabled=false'],
  },
  generates: {
    './src/types/sonar.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
      ],
      config: {
        rawRequest: true,
        extensionsType: 'unknown',
        noGraphQLTag: true,
        strictScalars: true,
        scalars: {
          JSON: 'JSON',
          DateTime: 'Date',
          _Any: 'unknown',
          Any: 'unknown',
        },
        // documentMode: 'string',
        // defaultScalarType: 'unknown',
      },
    },
  },
}

export default config
