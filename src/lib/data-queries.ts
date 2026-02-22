export interface TweetUser {
  displayName: string
  username: string | null
  followersCount: number | null
  followingCount: number | null
}

export interface Tweet {
  id: string
  xid: string
  text: string
  createdAt: string
  likeCount: number
  retweetCount: number
  replyCount: number
  user: TweetUser
}

export interface FeedTweet {
  score: number
  matchedKeywords: string[]
  tweet: Tweet
}

export interface Suggestion {
  suggestionId: string
  score: number
  projectsMatched: number
  status: string
  tweet: Tweet
}

export interface Interest {
  id: string
  name: string
  description: string | null
  keywords: string[] | null
  relatedTopics: string[] | null
  createdAt: string
  updatedAt: string
}

export const FEED_QUERY = `
  query DataFeed($hours: Int, $days: Int, $limit: Int) {
    feed(hours: $hours, days: $days, limit: $limit) {
      score
      matchedKeywords
      tweet {
        id
        xid
        text
        createdAt
        likeCount
        retweetCount
        replyCount
        user {
          displayName
          username
          followersCount
          followingCount
        }
      }
    }
  }
`

export const SUGGESTIONS_QUERY = `
  query DataSuggestions($status: SuggestionStatus, $limit: Int) {
    suggestions(status: $status, limit: $limit) {
      suggestionId
      score
      projectsMatched
      status
      tweet {
        id
        xid
        text
        createdAt
        likeCount
        retweetCount
        replyCount
        user {
          displayName
          username
          followersCount
          followingCount
        }
      }
    }
  }
`

export const INTERESTS_QUERY = `
  query DataInterests {
    projects {
      id: nanoId
      name
      description
      keywords
      relatedTopics
      createdAt
      updatedAt
    }
  }
`
