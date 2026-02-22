import { Text, Box } from 'ink'

export default function Index() {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Sonar CLI</Text>
      <Box flexDirection="column">
        <Text dimColor>Commands:</Text>
        <Text>  feed          Scored tweet feed from your network</Text>
        <Text>  inbox         Suggestions matching your interests</Text>
        <Text>  interests     Manage interests</Text>
        <Text>  └── create    Create a new interest</Text>
        <Text>  └── update    Update an interest</Text>
        <Text>  └── match     Match interests to ingested tweets</Text>
        <Text>  ingest        Ingest tweets and bookmarks</Text>
        <Text>  └── tweets    Ingest recent tweets from social graph</Text>
        <Text>  └── bookmarks Ingest X bookmarks</Text>
        <Text>  monitor       Job queue monitor and account status</Text>
        <Text>  config        Show or set CLI config</Text>
        <Text>  account       Account info and plan usage</Text>
      </Box>
      <Text dimColor>Run <Text color="cyan">sonar &lt;command&gt; --help</Text> for command-specific options.</Text>
    </Box>
  )
}
