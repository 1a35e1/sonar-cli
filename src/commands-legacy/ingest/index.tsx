import { Box, Text } from 'ink'

export default function Ingest() {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>sonar ingest</Text>
      <Box flexDirection="column">
        <Text dimColor>Subcommands:</Text>
        <Text>  tweets        Ingest recent tweets from your network</Text>
        <Text>  bookmarks     Ingest X bookmarks</Text>
      </Box>
      <Box flexDirection="column">
        <Text dimColor>Examples:</Text>
        <Text>  <Text color="cyan">sonar ingest tweets</Text></Text>
      </Box>
    </Box>
  )
}
