import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import * as ReactRouter from 'react-router';

import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import theme from 'app/utils/theme';
import space from 'app/styles/space';
import Checkbox from 'app/components/checkbox';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import {Organization, GlobalSelection, Project} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import EventView from 'app/utils/discover/eventView';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {
  IconFire,
  IconUser,
  IconCalendar,
  IconClock,
  IconLightning,
  IconGraph,
} from 'app/icons';
import Button from 'app/components/button';
import Duration from 'app/components/duration';

import KoaQuery, {SankeyLink, SankeyNode} from './koaQuery';
import SessionVis, {LABEL_FONT_SIZE, VIS_HEIGHT} from './sessionVis';
import Table from './table';
import {generatePerformanceEventView} from './data';
import {
  XYPlot,
  VerticalGridLines,
  HorizontalGridLines,
  XAxis,
  YAxis,
  MarkSeries,
} from 'react-vis';

export const IGNORE_VALUE = 'all';
const PAGELOAD_LABEL = '<Pageload>';

type Props = {
  api: Client;
  organization: Organization;
  selection: GlobalSelection;
  location: Location;
  router: ReactRouter.InjectedRouter;
  projects: Project[];
};

type State = {
  isPageloadAllowed: boolean;
  eventView: EventView;
  selectedNode: ModifiedSankeyNode | null;

  users: VisFilterItem[];

  showMagic: boolean;

  currentOpItem: VisFilterItem;
  currentValueItem: VisFilterItem;
  currentHeatItem: VisFilterItem;
  currentUserItem: VisFilterItem;
  currentSessionItem: VisFilterItem;
};

export type ModifiedSankeyLink = SankeyLink & {
  index: number;
};

export type ModifiedSankeyNode = SankeyNode & {
  index: number;
};

const DEFAULT_USER_ITEM: VisFilterItem = {
  label: 'All Users',
  value: IGNORE_VALUE,
};

const DEFAULT_SESSION_ITEM: VisFilterItem = {
  label: 'All Sessions',
  value: IGNORE_VALUE,
};

class UserSession extends React.Component<Props, State> {
  state: State = {
    isPageloadAllowed: true,
    eventView: generatePerformanceEventView(this.props.organization, this.props.location),

    selectedNode: null,

    users: [],

    showMagic: false,

    currentOpItem: this.getOpTypes()[0],
    currentValueItem: this.getValueTypes()[0],
    currentHeatItem: this.getHeatTypes()[0],
    currentUserItem: DEFAULT_USER_ITEM,
    currentSessionItem: DEFAULT_SESSION_ITEM,
  };

  handlePageloadAllowed = () => {
    const {isPageloadAllowed} = this.state;
    this.setState({
      isPageloadAllowed: !isPageloadAllowed,
    });
  };

  renderLoading() {
    return (
      <PageContent>
        <LoadingIndicator />
      </PageContent>
    );
  }

  setShowMagic = value => {
    this.setState({
      showMagic: value,
    });
  };

  setSelectedNode = node => {
    const {location} = this.props;
    this.setState({
      selectedNode: node,
    });

    ReactRouter.browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: this.buildFilterString(node),
      },
    });
  };

  getSummaryConditions(query: string) {
    const parsed = tokenizeSearch(query);
    parsed.query = [];

    return stringifyQueryObject(parsed);
  }

  getOpTypes(): VisFilterItem[] {
    return [
      {
        label: 'All',
        value: IGNORE_VALUE,
      },
      {
        label: 'Pageload',
        value: 'pageload',
      },
      {
        label: 'Navigation',
        value: 'navigation',
      },
    ];
  }

  getValueTypes(): VisFilterItem[] {
    return [
      {
        label: 'Transactions',
        value: 'transactions',
      },
      {
        label: 'Errors',
        value: 'error_count',
      },
      {
        label: 'Plan Changes',
        value: 'plan_changes',
      },
    ];
  }

  getHeatTypes(): VisFilterItem[] {
    return [
      {
        label: 'p50()',
        value: 'p50',
      },
      {
        label: 'Misery (%)',
        value: 'misery',
      },
      {
        label: 'Errors',
        value: 'errors',
      },
    ];
  }

  buildFilterString(selectedNode?: ModifiedSankeyNode) {
    if (!selectedNode) {
      selectedNode = this.state.selectedNode || undefined;
    }
    const others = [] as string[];

    if (selectedNode?.name === PAGELOAD_LABEL) {
      others.push('transaction.op:pageload');
    } else if (selectedNode) {
      others.push(`transaction:${selectedNode.name}`);
    }

    return `event.type:transaction ${others.join(' ')}`;
  }

  adjustLocation() {
    const {location} = this.props;
    const {selectedNode} = this.state;

    const clonedLocation = Object.assign({}, location);
    clonedLocation.query = Object.assign({}, location.query);

    if (selectedNode?.name === PAGELOAD_LABEL) {
      clonedLocation.query['transaction.op'] = 'pageload';
    } else if (selectedNode) {
      clonedLocation.query['transaction'] = selectedNode.name;
    }

    return clonedLocation;
  }

  setUsers = (users?: VisFilterItem[]) => {
    if (users && !this.state.users.length) {
      this.setState({
        users,
      });
    }
  };

  render() {
    const {api, location} = this.props;
    const {
      currentOpItem,
      selectedNode,
      currentValueItem,
      currentHeatItem,
      currentUserItem,
      currentSessionItem,
    } = this.state;
    const filterString = this.buildFilterString();
    const summaryConditions = this.getSummaryConditions(filterString);
    const palette = theme.charts.getColorPalette(5);

    const isHeatMisery = currentHeatItem.value === 'misery';

    let coloring = numericColoringFunction(
      [400, 600, 800, 1200, Number.MAX_SAFE_INTEGER],
      palette,
      'p50'
    );

    if (isHeatMisery) {
      console.log('Changing misery coloring');
      coloring = numericColoringFunction(
        [0.1, 0.5, 1, 2, Number.MAX_SAFE_INTEGER],
        palette,
        'percent_miserable'
      );
    }

    return (
      <div>
        <Panel>
          <PanelBody>
            <StyledVisContainer>
              <KoaQuery
                api={api}
                selectedTransaction={selectedNode}
                currentUserItem={currentUserItem}
                currentValueItem={currentValueItem}
                currentHeatItem={currentHeatItem}
                currentOpItem={currentOpItem}
                currentSessionItem={currentSessionItem}
                setUsers={this.setUsers}
              >
                {({data, isLoading}) => {
                  console.log('Received data: ', data);
                  let visLinks = data
                    ? [{source: 0, target: 1, value: 20}]
                    : ([] as any[]);
                  let namedNodes = [] as any[];
                  const distinctUsers = data?.meta.distinctUsers || [];
                  const userSessions = data?.meta.userSessions || [];

                  if (data) {
                    const {nodes, links} = data.data;

                    visLinks = links
                      .filter(l => l.source < l.target)
                      .map((l: any) => {
                        l.color = coloring(l);
                        return l;
                      });
                    namedNodes = nodes.map(({name, value}) => {
                      const _name = name || PAGELOAD_LABEL;
                      const nameShown =
                        value > data.meta.maxNodeValue * (LABEL_FONT_SIZE / VIS_HEIGHT);
                      return {
                        _name,
                        nameShown,
                        name: nameShown ? _name : '',
                        color: theme.purple500,
                      };
                    });
                  }
                  return (
                    <div>
                      <UnpaddedPanelItem>
                        <Splitter>
                          <Headered>
                            <PanelHeader>
                              <PanelTitle> </PanelTitle>
                              <RightSpread>
                                {/*

                                <VisDropdown
                                  prefix="Type"
                                  currentItem={currentOpItem}
                                  filterItems={this.getOpTypes()}
                                  handleChange={item =>
                                    this.setState({currentOpItem: item})
                                  }
                                />
                                    */}
                                <VisDropdown
                                  prefix="Value"
                                  currentItem={currentValueItem}
                                  filterItems={this.getValueTypes()}
                                  handleChange={item =>
                                    this.setState({
                                      currentValueItem: item,
                                      showMagic: false,
                                    })
                                  }
                                />
                                <VisDropdown
                                  prefix="Heat"
                                  currentItem={currentHeatItem}
                                  filterItems={this.getHeatTypes()}
                                  handleChange={item =>
                                    this.setState({currentHeatItem: item})
                                  }
                                />
                                <VisDropdown
                                  prefix="User"
                                  currentItem={currentUserItem}
                                  filterItems={[
                                    DEFAULT_USER_ITEM,
                                    ...this.state.users.slice(0, 100),
                                  ]}
                                  blurItem
                                  handleChange={item =>
                                    this.setState({currentUserItem: item})
                                  }
                                />
                                <VisDropdown
                                  prefix="Session"
                                  disabled={currentUserItem === DEFAULT_USER_ITEM}
                                  currentItem={currentSessionItem}
                                  filterItems={[
                                    DEFAULT_SESSION_ITEM,
                                    ...userSessions.slice(0, 100).map(({id, start}) => ({
                                      label: start,
                                      value: id,
                                    })),
                                  ]}
                                  handleChange={item =>
                                    this.setState({currentSessionItem: item})
                                  }
                                />
                              </RightSpread>
                            </PanelHeader>
                            <VisContainer>
                              {isLoading ? (
                                this.renderLoading()
                              ) : (
                                <SessionVis
                                  currentHeatItem={currentHeatItem}
                                  currentValueItem={currentValueItem}
                                  setSelectedNode={this.setSelectedNode}
                                  selectedNode={selectedNode}
                                  nodes={namedNodes}
                                  links={visLinks}
                                />
                              )}
                            </VisContainer>
                          </Headered>
                          <SidePanel>
                            <SummaryPanel>
                              <SummaryHeader>Summary</SummaryHeader>
                              <ItemContainer>
                                <StyledItem
                                  title="Users"
                                  body={data?.meta.distinctUsers.length}
                                >
                                  <IconUser />
                                </StyledItem>
                                <StyledItem
                                  title="User Sessions"
                                  body={data?.meta.userSessionCount}
                                >
                                  <IconCalendar />
                                </StyledItem>
                                <StyledItem
                                  title="Sessions With Misery"
                                  body={data?.meta.miserableSessionCount}
                                >
                                  <IconFire />
                                </StyledItem>
                                <StyledItem
                                  title="Avg. Session Duration"
                                  body={
                                    <Duration
                                      seconds={data?.meta.avgSessionTimeDiff || 0}
                                      fixedDigits={1}
                                    />
                                  }
                                >
                                  <IconClock />
                                </StyledItem>
                              </ItemContainer>
                            </SummaryPanel>
                            <BottomSummaryPanel>
                              {currentValueItem.value === 'plan_changes' &&
                                currentHeatItem.value === 'misery' && (
                                  <VisPanel
                                    data={data}
                                    showMagic={this.state.showMagic}
                                    setShowMagic={this.setShowMagic}
                                  />
                                )}
                            </BottomSummaryPanel>
                          </SidePanel>
                        </Splitter>
                      </UnpaddedPanelItem>
                    </div>
                  );
                }}
              </KoaQuery>
            </StyledVisContainer>
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

type vProps = {
  data: any;
  showMagic: boolean;
  setShowMagic: Function;
};

const VisPanel = (props: vProps) => {
  const scatterData =
    props.data?.scatterData.map(({plan_change_count, percent_misery}) => ({
      x: plan_change_count,
      y: percent_misery,
    })) || [];
  return props.showMagic ? (
    <ItemContainer>
      <StyledItem title="Correlation" body={props.data?.meta.correlation}>
        <IconGraph />
      </StyledItem>
      <XYPlot width={200} height={200}>
        <VerticalGridLines />
        <HorizontalGridLines />
        <XAxis />
        <YAxis />
        <MarkSeries
          className="mark-series-example"
          strokeWidth={2}
          sizeRange={[5, 15]}
          colorType="literal"
          data={scatterData}
        />
      </XYPlot>
    </ItemContainer>
  ) : (
    <Button onClick={() => props.setShowMagic(true)} icon={<IconLightning />}>
      Show me some magic
    </Button>
  );
};

function numericColoringFunction(
  intervals: number[],
  palette: Readonly<string[]>,
  colorValue: string,
  defaultColor?: string
) {
  if (palette.length !== intervals.length) {
    //throw new Error('Palette length must match provided intervals');
  }

  const _defaultColor = defaultColor || palette[palette.length - 1];
  return (value: any) => {
    return (
      palette.find((_, index) => {
        const paletteValue = intervals[index];
        if (value[colorValue] < paletteValue) {
          return true;
        }
        if (index === palette.length - 1) {
          return true; // Outermost
        }
        return false;
      }) || _defaultColor
    );
  };
}

const Headered = styled('div')`
  display: flex;
  flex-direction: column;
  position: relative;
  flex: 1;
`;

const UnpaddedPanelItem = styled(PanelItem)`
  padding: 0;
`;

const VisContainer = styled('div')`
  flex: 1;
`;

const Splitter = styled('div')`
  width: 100%;
  display: flex;
`;

const SidePanel = styled('div')`
  border-left: solid 1px ${p => p.theme.borderDark};
`;

const PanelTitle = styled('div')`
  padding-left: 20px;
  justify-self: center;
  align-items: center;
}
`;
const PanelHeader = styled('div')`
  display: flex;
  width: 100%;
`;

const RightSpread = styled('div')`
  display: flex;
  width: 100%;
  justify-content: flex-end;
`;

const SummaryPanel = styled('div')`
  padding: 20px;
`;

const BottomSummaryPanel = styled(SummaryPanel)`
  border-top: 1px solid ${p => p.theme.borderDark};
`;

type ItemProps = {
  title: string;
  body: string | React.ReactNode;
  children: React.ReactNode;
};

const Item = (props: ItemProps) => {
  return (
    <ItemWrapper>
      <FixedSplit>
        <FixedIcon>{props.children}</FixedIcon>
        <FixedP>
          <FixedHeader>{props.title}</FixedHeader>
          <FixedAmount>{props.body}</FixedAmount>
        </FixedP>
      </FixedSplit>
    </ItemWrapper>
  );
};

type VisProps = {
  prefix: string;
  filterItems: VisFilterItem[];
  currentItem: VisFilterItem;
  disabled?: boolean;
  blurItem?: boolean;
  handleChange: (item: VisFilterItem) => void;
};

export type VisFilterItem = {
  label: string;
  value: string;
};

const VisDropdown = (props: VisProps) => {
  const handleSelect = (selectedValue: string) =>
    props.handleChange(
      props.filterItems.find(({value}) => value === selectedValue) || props.filterItems[0]
    );
  return (
    <DropdownButtonWrapper disabled={props.disabled}>
      <DropdownControlWrapper
        buttonProps={{prefix: props.prefix}}
        label={
          props.blurItem
            ? props.currentItem.value !== IGNORE_VALUE
              ? '<redacted>'
              : props.currentItem.label
            : props.currentItem.label
        }
      >
        {props.filterItems.map(({label, value}, index) => (
          <DropdownItemWrapper
            key={value + label}
            onSelect={handleSelect}
            eventKey={value}
            isActive={value === props.currentItem.value}
          >
            {props.blurItem && value !== IGNORE_VALUE ? `${index}: <redacted>` : label}
          </DropdownItemWrapper>
        ))}
      </DropdownControlWrapper>
    </DropdownButtonWrapper>
  );
};

const DropdownControlWrapper = styled(DropdownControl)``;

const DropdownItemWrapper = styled(DropdownItem)`
  filter: ${p => (p.hasBlur ? 'blur(2px)' : '')};
`;

const SummaryHeader = styled('h5')`
  color: ${p => p.theme.gray500};
  font-size: 11px;
  margin-bottom: ${space(0.5)};
  text-transform: uppercase;
`;

const DropdownButtonWrapper = styled('div')`
  position: relative;
  margin: ${space(2)};
  margin-left: 0;
  opacity: ${p => (p.disabled ? '0.5' : '1.0')};
`;

const Centered = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const ItemWrapper = styled('div')`
  margin-bottom: ${space(3)};

  h5 {
    font-weight: 400;
    margin-bottom: ${space(1)};
  }
`;

const RightAligned = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
  text-align: right;
`;

const FixedHeader = styled('h5')`
  margin-bottom: 0;
`;

const FixedSplit = styled('div')`
  display: flex;
  flex-direction: row;
`;

const FixedIcon = styled('div')`
  margin-right: ${space(1)};
`;

const FixedP = styled('div')`
  flex-grow: 1;
`;

const FixedAmount = styled('div')`
  color: ${p => p.theme.gray500};
`;

const StyledItem = styled(Item)``;

const ItemContainer = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  width: 100%;
`;

const StyledVisContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;
const StyledVisHeader = styled('div')`
  display: flex;
  flex-direction: row;
  padding: ${space(1)};
  padding-left: 20px;
  padding-right: 20px;
`;
const Label = styled('label')`
  font-weight: normal;
  display: flex;
  margin-bottom: 0;
  white-space: nowrap;
  input {
    margin-top: 0;
    margin-right: ${space(1)};
  }
`;

export default withApi(withOrganization(withProjects(withGlobalSelection(UserSession))));
