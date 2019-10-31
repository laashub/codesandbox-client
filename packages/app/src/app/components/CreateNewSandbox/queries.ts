import gql from 'graphql-tag';
import { client } from 'app/graphql/client';
import immer from 'immer';
import {
  SANDBOX_FRAGMENT,
  addSandboxesToFolder,
  PATHED_SANDBOXES_CONTENT_QUERY,
} from 'app/pages/Dashboard/queries';
import { notificationState } from '@codesandbox/common/lib/utils/notifications';
import track from '@codesandbox/common/lib/utils/analytics';
import { NotificationStatus } from '@codesandbox/notifications';
import {
  UnmakeSandboxesTemplateMutation,
  UnmakeSandboxesTemplateMutationVariables,
  ListTemplatesQueryVariables,
  ListTemplatesQuery,
  Collection,
  PathedSandboxesQuery,
} from 'app/graphql/types';

export const LIST_BOOKMARKED_TEMPLATES = gql`
  query ListBookmarkedTemplates {
    me {
      teams {
        id
        name
        bookmarkedTemplates {
          color
          iconUrl
          id
          published
          sandbox {
            ...Sandbox
          }
        }
      }
      bookmarkedTemplates {
        color
        iconUrl
        id
        published
        sandbox {
          ...Sandbox
        }
      }
    }
  }

  ${SANDBOX_FRAGMENT}
`;

export const LIST_TEMPLATES = gql`
  query ListTemplates($teamId: ID, $showAll: Boolean) {
    me {
      templates(teamId: $teamId, showAll: $showAll) {
        color
        iconUrl
        id
        published
        sandbox {
          ...Sandbox
          author {
            username
          }
        }
      }
    }
  }

  ${SANDBOX_FRAGMENT}
`;

export const MAKE_SANDBOXES_TEMPLATE_MUTATION = gql`
  mutation MakeSandboxesTemplate($sandboxIds: [ID]!) {
    makeSandboxesTemplates(sandboxIds: $sandboxIds) {
      id
    }
  }
`;

export const UNMAKE_SANDBOXES_TEMPLATE_MUTATION = gql`
  mutation UnmakeSandboxesTemplate($sandboxIds: [ID]!) {
    unmakeSandboxesTemplates(sandboxIds: $sandboxIds) {
      id
    }
  }
  ${SANDBOX_FRAGMENT}
`;

export function unmakeTemplates(selectedSandboxes: string[], teamId?: string) {
  return client.mutate<
    UnmakeSandboxesTemplateMutation,
    UnmakeSandboxesTemplateMutationVariables
  >({
    mutation: UNMAKE_SANDBOXES_TEMPLATE_MUTATION,
    variables: {
      sandboxIds: selectedSandboxes,
    },
    refetchQueries: [
      'DeletedSandboxes',
      'PathedSandboxes',
      'RecentSandboxes',
      'SearchSandboxes',
      'ListTemplates',
    ],
    update: cache => {
      try {
        const variables: Partial<ListTemplatesQueryVariables> = {};

        if (teamId) {
          variables.teamId = teamId;
        }

        const oldTemplatesCache = cache.readQuery<ListTemplatesQuery>({
          query: LIST_TEMPLATES,
          variables,
        });

        const data = immer(oldTemplatesCache, draft => {
          draft.me.templates = draft.me.templates.filter(
            x => selectedSandboxes.indexOf(x.sandbox.id) === -1
          );
        });

        cache.writeQuery({
          query: LIST_TEMPLATES,
          variables,
          data,
        });
      } catch (e) {
        // cache doesn't exist, no biggie!
      }
    },
  });
}

export function makeTemplates(
  selectedSandboxes: string[],
  teamId?: string,
  collections?: Collection[]
) {
  const unpackedSelectedSandboxes: string[] =
    // @ts-ignore
    typeof selectedSandboxes.toJS === 'function'
      ? (selectedSandboxes as any).toJS()
      : selectedSandboxes;
  return Promise.all([
    addSandboxesToFolder(unpackedSelectedSandboxes, '/', teamId),
    client
      .mutate({
        mutation: MAKE_SANDBOXES_TEMPLATE_MUTATION,
        variables: {
          sandboxIds: unpackedSelectedSandboxes,
        },
        refetchQueries: [
          'DeletedSandboxes',
          'PathedSandboxes',
          'RecentSandboxes',
          'SearchSandboxes',
          'ListTemplates',
        ],
        update: cache => {
          if (collections) {
            collections.forEach(({ path, teamId: cacheTeamId }) => {
              try {
                const variables: { path: string; teamId?: string } = { path };

                if (cacheTeamId) {
                  variables.teamId = cacheTeamId;
                }

                const oldFolderCacheData = cache.readQuery<
                  PathedSandboxesQuery
                >({
                  query: PATHED_SANDBOXES_CONTENT_QUERY,
                  variables,
                });

                const data = immer(oldFolderCacheData, draft => {
                  draft.me.collection.sandboxes = oldFolderCacheData.me.collection.sandboxes.filter(
                    x => selectedSandboxes.indexOf(x.id) === -1
                  );
                });

                cache.writeQuery({
                  query: PATHED_SANDBOXES_CONTENT_QUERY,
                  variables,
                  data,
                });
              } catch (e) {
                // cache doesn't exist, no biggie!
              }
            });
          }
        },
      })
      .then(() => {
        notificationState.addNotification({
          message: `Successfully created ${selectedSandboxes.length} template${
            selectedSandboxes.length === 1 ? '' : 's'
          }`,
          status: NotificationStatus.SUCCESS,
          actions: {
            primary: [
              {
                label: 'Undo',
                run: () => {
                  track('Template - Removed', {
                    source: 'Undo',
                  });
                  unmakeTemplates(unpackedSelectedSandboxes);
                },
              },
            ],
          },
        });
      }),
  ]);
}