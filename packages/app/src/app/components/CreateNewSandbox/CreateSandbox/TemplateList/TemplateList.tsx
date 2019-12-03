import React from 'react';
import { TemplateFragment } from 'app/graphql/types';
import { sandboxUrl } from '@codesandbox/common/lib/utils/url-generator';
import { useOvermind } from 'app/overmind';
import { useKey } from 'react-use';
import { isMac } from '@codesandbox/common/lib/utils/platform';
import { getSandboxName } from '@codesandbox/common/lib/utils/get-sandbox-name';
import history from 'app/utils/history';
import MdEditIcon from 'react-icons/lib/md/edit';

import Tooltip from '@codesandbox/common/lib/components/Tooltip';
import { SandboxCard } from '../SandboxCard';
import { SubHeader, Grid } from '../elements';
import { EditIcon, TemplateInfoContainer } from './elements';

export interface ITemplateInfo {
  title?: string;
  key: string;
  templates: TemplateFragment[];
}

export interface ITemplateListProps {
  templateInfos: ITemplateInfo[];
  forkOnOpen?: boolean;
  columnCount?: number;
}

const MODIFIER_KEY = isMac ? 'Ctrl' : '⇧';

const getNumber = (e: KeyboardEvent): number => {
  if (e.code && e.code.startsWith('Digit')) {
    return parseInt(e.code.replace('Digit', ''), 10);
  }

  return NaN;
};

export const TemplateList = ({
  templateInfos,
  forkOnOpen,
  columnCount = 2,
}: ITemplateListProps) => {
  const { actions } = useOvermind();
  const [focusedTemplateIndex, setFocusedTemplate] = React.useState(0);
  const lastMouseMoveEventAt = React.useRef<number>(Date.now());

  const openSandbox = (
    sandbox: TemplateFragment['sandbox'],
    openInNewWindow = false
  ) => {
    if (forkOnOpen) {
      actions.editor.forkExternalSandbox({
        sandboxId: sandbox.id,
        openInNewWindow,
      });
    } else {
      history.push(sandboxUrl(sandbox));
    }

    return actions.modalClosed();
  };

  React.useEffect(() => {
    const listener = () => {
      lastMouseMoveEventAt.current = Date.now();
    };

    window.addEventListener('mousemove', listener);

    return () => {
      window.removeEventListener('mousemove', listener);
    };
  }, []);

  const getTemplateInfoByIndex = React.useCallback(
    (index: number) => {
      let count = 0;
      let i = 0;
      while (index >= count && i < templateInfos.length) {
        count += templateInfos[i].templates.length;
        i++;
      }
      return {
        templateInfo: templateInfos[i - 1],
        offset: count - templateInfos[i - 1].templates.length,
      };
    },
    [templateInfos]
  );

  const getTemplateByIndex = React.useCallback(
    (index: number) => {
      const { templateInfo, offset } = getTemplateInfoByIndex(index);

      const indexInTemplateInfo = index - offset;
      return templateInfo.templates[indexInTemplateInfo];
    },
    [getTemplateInfoByIndex]
  );

  const getColumnCountInLastRow = (templateInfo: ITemplateInfo) =>
    templateInfo.templates.length % columnCount || columnCount;

  const getTotalTemplateCount = React.useCallback(
    () =>
      templateInfos.reduce(
        (total, templateInfo) => total + templateInfo.templates.length,
        0
      ),
    [templateInfos]
  );

  /**
   * Ensures that the next set is in bound of 0 and the max template count
   */
  const safeSetFocusedTemplate = React.useCallback(
    (setter: (newPos: number) => number) => {
      const totalCount = getTotalTemplateCount();

      return setFocusedTemplate(i =>
        Math.max(0, Math.min(setter(i), totalCount - 1))
      );
    },
    [getTotalTemplateCount]
  );

  React.useEffect(() => {
    // Make sure our index stays in bounds with max templateInfos

    const totalCount = getTotalTemplateCount();

    if (focusedTemplateIndex >= totalCount || focusedTemplateIndex < 0) {
      safeSetFocusedTemplate(i => i);
    }

    // We only want this check to happen if templateInfos changes. Only then we
    // can get our index out of bounds
    // eslint-disable-next-line
  }, [templateInfos]);

  useKey(
    'ArrowRight',
    evt => {
      evt.preventDefault();
      safeSetFocusedTemplate(i => i + 1);
    },
    {},
    [safeSetFocusedTemplate]
  );

  useKey(
    'ArrowLeft',
    evt => {
      evt.preventDefault();
      safeSetFocusedTemplate(i => i - 1);
    },
    {},
    [safeSetFocusedTemplate]
  );

  useKey(
    'ArrowDown',
    evt => {
      evt.preventDefault();
      const { templateInfo, offset } = getTemplateInfoByIndex(
        focusedTemplateIndex
      );
      const indexInTemplateInfo = focusedTemplateIndex - offset;
      const totalRowCount = Math.ceil(
        templateInfo.templates.length / columnCount
      );
      const currentRow = Math.floor(indexInTemplateInfo / columnCount);
      const isLastRow = totalRowCount === currentRow + 1;
      const isSecondToLastRow = totalRowCount === currentRow + 2;
      const nextTemplateInfo =
        templateInfos[templateInfos.indexOf(templateInfo) + 1] || templateInfo;
      const { templateInfo: templateInfoUnder } = getTemplateInfoByIndex(
        focusedTemplateIndex + columnCount
      );
      const columnCountInLastRow = getColumnCountInLastRow(templateInfo);

      const indexInRow = indexInTemplateInfo % columnCount;
      const hasItemUnder =
        (!isLastRow &&
          (!isSecondToLastRow || indexInRow < columnCountInLastRow)) ||
        (!isSecondToLastRow && templateInfoUnder === nextTemplateInfo);

      const itemsAfterCurrentItemInRow =
        (isLastRow ? columnCountInLastRow : columnCount) - 1 - indexInRow;

      safeSetFocusedTemplate(
        i =>
          i +
          Math.min(
            hasItemUnder
              ? // index + leftover items
                // example:
                // 1 | 2
                // 3 | 4 | 5
                // in case of 2, to get to 4 we would do
                // currentPos + (itemsAfter) + 1 + (indexInRow) = 2 + 0 + 1 + 1 = 4
                // second example:
                // 1 | 2 | 3
                // 4 | 5
                // from 2 to 5 is
                // currentPos + (itemsAfter) + 1 + (indexInRow) = 2 + 1 + 1 + 1 = 5
                Math.min(
                  itemsAfterCurrentItemInRow + 1 + indexInRow,
                  columnCount
                )
              : itemsAfterCurrentItemInRow + 1,
            templateInfo.templates.length
          )
      );
    },
    {},
    [
      focusedTemplateIndex,
      getTemplateInfoByIndex,
      safeSetFocusedTemplate,
      templateInfos,
    ]
  );

  useKey(
    'ArrowUp',
    evt => {
      evt.preventDefault();
      const { templateInfo, offset } = getTemplateInfoByIndex(
        focusedTemplateIndex
      );
      const previousTemplateInfo =
        templateInfos[templateInfos.indexOf(templateInfo) - 1] || templateInfo;
      const indexInTemplateInfo = focusedTemplateIndex - offset;
      const isFirstRow = indexInTemplateInfo < columnCount;

      const indexInRow = indexInTemplateInfo % columnCount;
      const { templateInfo: templateInfoAbove } = getTemplateInfoByIndex(
        Math.max(0, focusedTemplateIndex - (indexInRow + 1))
      );
      const columnCountInPreviousRow = isFirstRow
        ? getColumnCountInLastRow(previousTemplateInfo)
        : columnCount;
      const hasItemAbove =
        !isFirstRow ||
        (templateInfoAbove === previousTemplateInfo &&
          columnCountInPreviousRow > indexInRow);

      safeSetFocusedTemplate(
        i => i - (hasItemAbove ? columnCountInPreviousRow : indexInRow + 1)
      );
    },
    {},
    [
      focusedTemplateIndex,
      getTemplateInfoByIndex,
      safeSetFocusedTemplate,
      templateInfos,
    ]
  );

  /**
   * Our listener for CMD/CTRL + Num calls
   */
  useKey(
    e => {
      const num = getNumber(e);
      const modifierCheck = isMac ? e.ctrlKey : e.shiftKey;
      return num > 0 && num < 10 && modifierCheck;
    },
    e => {
      const num = getNumber(e);

      const template = getTemplateByIndex(num - 1);
      openSandbox(template.sandbox);
    },
    {},
    [focusedTemplateIndex, getTemplateByIndex, openSandbox]
  );

  /**
   * We have this one to listen to any opening when focus is on an input
   */
  useKey(
    'Enter',
    e => {
      if (
        !e.defaultPrevented &&
        document.activeElement &&
        document.activeElement.tagName === 'INPUT'
      ) {
        e.preventDefault();
        const currentTemplate = getTemplateByIndex(focusedTemplateIndex);
        openSandbox(currentTemplate.sandbox, isMac ? e.metaKey : e.ctrlKey);
      }
    },
    {},
    [focusedTemplateIndex, getTemplateByIndex, openSandbox]
  );

  let offset = 0;
  return (
    <>
      {templateInfos.map(({ templates, title, key }, templateInfoIndex) => {
        if (templateInfoIndex > 0) {
          offset += templateInfos[templateInfoIndex - 1].templates.length;
        }

        if (templates.length === 0) {
          return null;
        }

        return (
          <TemplateInfoContainer key={key}>
            {title !== undefined && <SubHeader>{title}</SubHeader>}
            <Grid columnCount={columnCount}>
              {templates.map((template: TemplateFragment, i) => {
                const index = offset + i;
                const focused = focusedTemplateIndex === offset + i;

                const shortKey =
                  index < 9 ? `${MODIFIER_KEY}+${index + 1}` : '';
                const detailText = focused ? '↵' : shortKey;

                return (
                  <SandboxCard
                    key={template.id}
                    title={getSandboxName(template.sandbox)}
                    iconUrl={template.iconUrl}
                    // @ts-ignore
                    environment={template.sandbox.source.template}
                    color={template.color}
                    onFocus={() => {
                      safeSetFocusedTemplate(() => index);
                    }}
                    onMouseOver={() => {
                      // This is to prevent selecting with your mouse on scroll move
                      if (Date.now() - lastMouseMoveEventAt.current < 500) {
                        safeSetFocusedTemplate(() => index);
                      }
                    }}
                    onKeyPress={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        openSandbox(
                          template.sandbox,
                          isMac ? e.metaKey : e.ctrlKey
                        );
                      }
                    }}
                    onClick={e => {
                      e.preventDefault();

                      openSandbox(
                        template.sandbox,
                        isMac ? e.metaKey : e.ctrlKey
                      );
                    }}
                    focused={focused}
                    detailText={detailText}
                    DetailComponent={
                      forkOnOpen
                        ? () => (
                            <Tooltip content="Edit Template">
                              <EditIcon
                                onClick={evt => {
                                  evt.stopPropagation();
                                  actions.modalClosed();
                                }}
                                to={sandboxUrl(template.sandbox)}
                              >
                                <MdEditIcon />
                              </EditIcon>
                            </Tooltip>
                          )
                        : undefined
                    }
                  />
                );
              })}
            </Grid>
          </TemplateInfoContainer>
        );
      })}
    </>
  );
};
