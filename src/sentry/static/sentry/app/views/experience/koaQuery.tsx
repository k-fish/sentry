import React from 'react';

import {Client} from 'app/api';

import {VisFilterItem, IGNORE_VALUE} from './sessions';

export type SankeyLink = {
  source: number;
  target: number;
  value: number;
  p50: number;
};
export type SankeyNode = {
  name: string;
  value: number;
};

type VisModifiedSankeyNode = SankeyNode & {
  _name: string;
};

export type GroupedSessionData = {
  nodes: SankeyNode[];
  links: SankeyLink[];
};
export type KoaData = {
  data: GroupedSessionData;
  meta: any;
};

type Props = {
  api: Client;
  selectedTransaction?: VisModifiedSankeyNode | null;

  currentOpItem: VisFilterItem;
  currentValueItem: VisFilterItem;
  currentHeatItem: VisFilterItem;
  currentUserItem: VisFilterItem;
  currentSessionItem: VisFilterItem;
  children: (props: ChildrenProps) => React.ReactNode;

  setUsers: Function;
};

type ChildrenProps = {
  isLoading: boolean;
  error: null | string;
  data: KoaData | null;
};

type State = {} & ChildrenProps;

class KoaQuery extends React.Component<Props, State> {
  state: State = {
    isLoading: true,
    error: null,
    data: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (this.shouldRefetchData(prevProps)) {
      this.fetchData();
    }
  }

  shouldRefetchData(prevProps: Props) {
    return (
      prevProps.selectedTransaction !== this.props.selectedTransaction ||
      prevProps.currentOpItem !== this.props.currentOpItem ||
      prevProps.currentHeatItem !== this.props.currentHeatItem ||
      prevProps.currentValueItem !== this.props.currentValueItem ||
      prevProps.currentUserItem !== this.props.currentUserItem ||
      prevProps.currentSessionItem !== this.props.currentSessionItem
    );
  }

  fetchData = async () => {
    const {
      api,
      selectedTransaction,
      currentOpItem,
      currentHeatItem,
      currentValueItem,
      currentUserItem,
      currentSessionItem,
    } = this.props;

    api.baseUrl = 'http://localhost:3001';
    const url = `/groupedsessions`;
    const apiPayload = {} as any;

    if (selectedTransaction && selectedTransaction._name) {
      apiPayload.selectedTransaction = selectedTransaction._name;
    }

    if (currentOpItem && currentOpItem.value !== IGNORE_VALUE) {
      apiPayload.currentOpItem = currentOpItem.value;
    }

    if (currentHeatItem && currentHeatItem.value !== IGNORE_VALUE) {
      apiPayload.currentHeatItem = currentHeatItem.value;
    }

    if (currentValueItem && currentValueItem.value !== IGNORE_VALUE) {
      apiPayload.currentValueItem = currentValueItem.value;
    }

    if (currentUserItem && currentUserItem.value !== IGNORE_VALUE) {
      apiPayload.currentUserItem = currentUserItem.value;
    }

    if (currentSessionItem && currentSessionItem.value !== IGNORE_VALUE) {
      apiPayload.currentSessionItem = currentSessionItem.value;
    }

    this.setState({isLoading: true});

    try {
      const [data] = await api.requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: {
          ...(apiPayload as any),
        },
      });
      this.setState({
        isLoading: false,
        error: null,
        data,
      });

      this.props.setUsers(
        data?.meta.distinctUsers.map(({name}) => ({
          label: name,
          value: name,
        }))
      );
    } catch (e) {
      this.setState({
        isLoading: false,
        data: null,
        error: e?.responseJSON?.detail ?? null,
      });
    }
  };
  render() {
    const {isLoading, error, data} = this.state;

    const childrenProps = {
      isLoading,
      error,
      data,
    };

    return this.props.children(childrenProps);
  }
}

export default KoaQuery;
