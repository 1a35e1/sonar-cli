import { GraphQLClient, RequestOptions } from 'graphql-request';
import { GraphQLError, print } from 'graphql'
import { DocumentNode } from 'graphql';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: Date; output: Date; }
  JSON: { input: JSON; output: JSON; }
  _Any: { input: unknown; output: unknown; }
};

export type Account = {
  __typename?: 'Account';
  accountId: Scalars['ID']['output'];
  email?: Maybe<Scalars['String']['output']>;
  indexedTweets: Scalars['Int']['output'];
  indexingAccounts: Scalars['Int']['output'];
  isPayingCustomer: Scalars['Boolean']['output'];
  pendingEmbeddings: Scalars['Int']['output'];
  refreshedSuggestionsAt?: Maybe<Scalars['DateTime']['output']>;
  twitterIndexedAt?: Maybe<Scalars['DateTime']['output']>;
  xHandle: Scalars['String']['output'];
  xid: Scalars['String']['output'];
};

export type AllMutations = {
  __typename?: 'AllMutations';
  connect: AuthPayload;
  createApiKey: ApiKeyPayload;
  createOrUpdateProject: Project;
  indexBookmarks: Scalars['Boolean']['output'];
  indexTweets: Scalars['Boolean']['output'];
  rebuildSocialGraph: Scalars['Boolean']['output'];
  regenerateSuggestions: Scalars['Boolean']['output'];
  revokeApiKey: Scalars['Boolean']['output'];
  updateSuggestion: Suggestion;
};


export type AllMutationsConnectArgs = {
  authToken: Scalars['String']['input'];
  xOauthRefreshToken?: InputMaybe<Scalars['String']['input']>;
  xOauthToken?: InputMaybe<Scalars['String']['input']>;
};


export type AllMutationsCreateApiKeyArgs = {
  name: Scalars['String']['input'];
};


export type AllMutationsCreateOrUpdateProjectArgs = {
  input: ProjectInput;
};


export type AllMutationsRebuildSocialGraphArgs = {
  force?: Scalars['Boolean']['input'];
};


export type AllMutationsRegenerateSuggestionsArgs = {
  days?: Scalars['Int']['input'];
};


export type AllMutationsRevokeApiKeyArgs = {
  apiKeyId: Scalars['ID']['input'];
};


export type AllMutationsUpdateSuggestionArgs = {
  input: UpdateSuggestionInput;
};

export type ApiKey = {
  __typename?: 'ApiKey';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  keyPrefix: Scalars['String']['output'];
  lastUsedAt?: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
};

export type ApiKeyPayload = {
  __typename?: 'ApiKeyPayload';
  apiKey: ApiKey;
  key: Scalars['String']['output'];
};

export type AuthPayload = {
  __typename?: 'AuthPayload';
  accountId: Scalars['String']['output'];
  token: Scalars['String']['output'];
};

export type DimensionUsage = {
  __typename?: 'DimensionUsage';
  atLimit: Scalars['Boolean']['output'];
  limit?: Maybe<Scalars['Int']['output']>;
  used: Scalars['Int']['output'];
};

export type FeedTweet = {
  __typename?: 'FeedTweet';
  matchedKeywords: Array<Scalars['String']['output']>;
  score: Scalars['Float']['output'];
  tweet: Tweet;
};

export type Project = {
  __typename?: 'Project';
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  keywords?: Maybe<Array<Scalars['String']['output']>>;
  name: Scalars['String']['output'];
  nanoId: Scalars['String']['output'];
  projectId: Scalars['ID']['output'];
  relatedTopics?: Maybe<Array<Scalars['String']['output']>>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type ProjectInput = {
  description: Scalars['String']['input'];
  keywords: Array<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  nanoId?: InputMaybe<Scalars['String']['input']>;
  relatedTopics?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type Query = {
  __typename?: 'Query';
  _service: _Service;
  apiKeys: Array<ApiKey>;
  feed: Array<FeedTweet>;
  me?: Maybe<Account>;
  projects: Array<Project>;
  suggestionCounts: SuggestionCounts;
  suggestions: Array<Suggestion>;
  tweet?: Maybe<Tweet>;
  usage?: Maybe<Usage>;
};


export type QueryFeedArgs = {
  days?: InputMaybe<Scalars['Int']['input']>;
  hours?: InputMaybe<Scalars['Int']['input']>;
  kind?: Scalars['String']['input'];
  limit?: Scalars['Int']['input'];
};


export type QuerySuggestionsArgs = {
  limit?: Scalars['Int']['input'];
  offset?: Scalars['Int']['input'];
  status?: InputMaybe<SuggestionStatus>;
};


export type QueryTweetArgs = {
  id: Scalars['ID']['input'];
};

export enum RelevanceLevel {
  High = 'HIGH',
  Low = 'LOW',
  Medium = 'MEDIUM',
  None = 'NONE'
}

export type Suggestion = {
  __typename?: 'Suggestion';
  average: Scalars['Float']['output'];
  /** JSON metadata containing project scores and other data */
  metadata: Scalars['JSON']['output'];
  projectsMatched: Scalars['Int']['output'];
  relevance?: Maybe<Scalars['Int']['output']>;
  score: Scalars['Float']['output'];
  status: Scalars['String']['output'];
  suggestionId: Scalars['ID']['output'];
  tweet: Tweet;
};

export type SuggestionCounts = {
  __typename?: 'SuggestionCounts';
  archived: Scalars['Int']['output'];
  inbox: Scalars['Int']['output'];
  later: Scalars['Int']['output'];
  read: Scalars['Int']['output'];
  replied: Scalars['Int']['output'];
  skipped: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type SuggestionRefreshUsage = {
  __typename?: 'SuggestionRefreshUsage';
  atLimit: Scalars['Boolean']['output'];
  limit?: Maybe<Scalars['Int']['output']>;
  resetsAt?: Maybe<Scalars['DateTime']['output']>;
  used: Scalars['Int']['output'];
};

export enum SuggestionStatus {
  Archived = 'ARCHIVED',
  Inbox = 'INBOX',
  Later = 'LATER',
  Read = 'READ',
  Replied = 'REPLIED',
  Skipped = 'SKIPPED'
}

export type Tweet = {
  __typename?: 'Tweet';
  bookmarkCount: Scalars['Int']['output'];
  conversationId?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  id?: Maybe<Scalars['ID']['output']>;
  kind: Scalars['String']['output'];
  likeCount: Scalars['Int']['output'];
  parent?: Maybe<Tweet>;
  post?: Maybe<Tweet>;
  quoteCount: Scalars['Int']['output'];
  replyCount: Scalars['Int']['output'];
  retweetCount: Scalars['Int']['output'];
  text: Scalars['String']['output'];
  user: User;
  viewCount: Scalars['Int']['output'];
  xid: Scalars['ID']['output'];
};

export type UpdateSuggestionInput = {
  score?: InputMaybe<RelevanceLevel>;
  status?: InputMaybe<SuggestionStatus>;
  suggestionId: Scalars['ID']['input'];
};

export type Usage = {
  __typename?: 'Usage';
  apiKeys: DimensionUsage;
  bookmarksEnabled: Scalars['Boolean']['output'];
  interests: DimensionUsage;
  plan: Scalars['String']['output'];
  socialGraphDegrees: Scalars['Int']['output'];
  socialGraphMaxUsers?: Maybe<Scalars['Int']['output']>;
  suggestionRefreshes: SuggestionRefreshUsage;
};

export type User = {
  __typename?: 'User';
  avatar?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  followersCount?: Maybe<Scalars['Int']['output']>;
  followingCount?: Maybe<Scalars['Int']['output']>;
  username?: Maybe<Scalars['String']['output']>;
  xid: Scalars['ID']['output'];
};

export type _Service = {
  __typename?: '_Service';
  sdl: Scalars['String']['output'];
};

export type IndexBookmarksMutationVariables = Exact<{ [key: string]: never; }>;


export type IndexBookmarksMutation = { __typename?: 'AllMutations', indexBookmarks: boolean };

export type IndexTweetsMutationVariables = Exact<{ [key: string]: never; }>;


export type IndexTweetsMutation = { __typename?: 'AllMutations', indexTweets: boolean };

export type RegenerateSuggestionsMutationVariables = Exact<{
  days?: InputMaybe<Scalars['Int']['input']>;
}>;


export type RegenerateSuggestionsMutation = { __typename?: 'AllMutations', regenerateSuggestions: boolean };

export type MonitorStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type MonitorStatusQuery = { __typename?: 'Query', me?: { __typename?: 'Account', accountId: string, email?: string | null, xHandle: string, xid: string, isPayingCustomer: boolean, indexingAccounts: number, indexedTweets: number, pendingEmbeddings: number, twitterIndexedAt?: Date | null, refreshedSuggestionsAt?: Date | null } | null };


export const IndexBookmarksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"IndexBookmarks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"indexBookmarks"}}]}}]} as unknown as DocumentNode;
export const IndexTweetsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"IndexTweets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"indexTweets"}}]}}]} as unknown as DocumentNode;
export const RegenerateSuggestionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegenerateSuggestions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"days"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"regenerateSuggestions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"days"},"value":{"kind":"Variable","name":{"kind":"Name","value":"days"}}}]}]}}]} as unknown as DocumentNode;
export const MonitorStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MonitorStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accountId"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"xHandle"}},{"kind":"Field","name":{"kind":"Name","value":"xid"}},{"kind":"Field","name":{"kind":"Name","value":"isPayingCustomer"}},{"kind":"Field","name":{"kind":"Name","value":"indexingAccounts"}},{"kind":"Field","name":{"kind":"Name","value":"indexedTweets"}},{"kind":"Field","name":{"kind":"Name","value":"pendingEmbeddings"}},{"kind":"Field","name":{"kind":"Name","value":"twitterIndexedAt"}},{"kind":"Field","name":{"kind":"Name","value":"refreshedSuggestionsAt"}}]}}]}}]} as unknown as DocumentNode;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();
const IndexBookmarksDocumentString = print(IndexBookmarksDocument);
const IndexTweetsDocumentString = print(IndexTweetsDocument);
const RegenerateSuggestionsDocumentString = print(RegenerateSuggestionsDocument);
const MonitorStatusDocumentString = print(MonitorStatusDocument);
export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    IndexBookmarks(variables?: IndexBookmarksMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: IndexBookmarksMutation; errors?: GraphQLError[]; extensions?: unknown; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<IndexBookmarksMutation>(IndexBookmarksDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'IndexBookmarks', 'mutation', variables);
    },
    IndexTweets(variables?: IndexTweetsMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: IndexTweetsMutation; errors?: GraphQLError[]; extensions?: unknown; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<IndexTweetsMutation>(IndexTweetsDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'IndexTweets', 'mutation', variables);
    },
    RegenerateSuggestions(variables?: RegenerateSuggestionsMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: RegenerateSuggestionsMutation; errors?: GraphQLError[]; extensions?: unknown; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<RegenerateSuggestionsMutation>(RegenerateSuggestionsDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'RegenerateSuggestions', 'mutation', variables);
    },
    MonitorStatus(variables?: MonitorStatusQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: MonitorStatusQuery; errors?: GraphQLError[]; extensions?: unknown; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<MonitorStatusQuery>(MonitorStatusDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'MonitorStatus', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;