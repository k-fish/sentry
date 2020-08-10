import React from 'react';
import {makeWidthFlexible, Sankey, Hint} from 'react-vis';
import {any} from 'prop-types';

import withApi from 'app/utils/withApi';
import styled from 'app/styled';
import theme from 'app/utils/theme';
import Button from 'app/components/button';
import {IconRefresh} from 'app/icons';

import {SankeyLink, SankeyNode} from './koaQuery';
import {
  ModifiedSankeyLink,
  ModifiedSankeyNode,
  VisFilterItem,
  IGNORE_VALUE,
} from './sessions';

export const LABEL_FONT_SIZE = 14;
export const LABEL_MAX_CHARS = 35;
export const VIS_HEIGHT = 500;

const BLURRED_LINK_OPACITY = 0.5;
const FOCUSED_LINK_OPACITY = 0.9;

type Props = {
  links: SankeyLink[];
  nodes: SankeyNode[];
  selectedNode: ModifiedSankeyNode | null;
  setSelectedNode: Function;

  currentValueItem: VisFilterItem;
  currentHeatItem: VisFilterItem;
};

type State = {
  activeLink: ModifiedSankeyLink | null;
  activeNode: ModifiedSankeyNode | null;
};

class SessionVis extends React.Component<Props, State> {
  state: State = {
    activeLink: null,
    activeNode: null,
  };

  setActiveNode = node => {
    this.setState({
      activeNode: node,
    });
  };

  setActiveLink = link => {
    this.setState({
      activeLink: link,
    });
  };

  _renderHint() {
    const {currentValueItem, currentHeatItem} = this.props;
    const {activeLink} = this.state;

    if (!activeLink) {
      return null;
    }

    // calculate center x,y position of link for positioning of hint
    const x = activeLink.source.x1 + (activeLink.target.x0 - activeLink.source.x1) / 2;
    const y = activeLink.y0 - (activeLink.y0 - activeLink.y1) / 2;

    const hintValue = {};
    const from = activeLink.source.name;
    const to = activeLink.target.name || activeLink.target._name;
    const label = `${from} ➞ ${to}`;
    hintValue[label] = activeLink.value;

    //app/components/charts/releaseSeries.jsx
    // <TooltipContent>{label}</TooltipContent>

    return (
      <Hint x={x} y={y} value={hintValue}>
        <TooltipDataContent>
          <TooltipSeries>
            <div>
              <strong>From:&nbsp;</strong>
              <span>{from}</span>
            </div>
            <div>
              <strong>To:&nbsp;</strong>
              <span>{to}</span>
            </div>
          </TooltipSeries>
          <TooltipAuxiliary>
            <TooltipLabel
              label={`${currentHeatItem.label}`}
              value={activeLink[currentHeatItem.value]}
            />
            {currentValueItem.value === 'plan_changes' && (
              <TooltipLabel label="plan changes" value={activeLink.plan_changes} />
            )}
          </TooltipAuxiliary>
        </TooltipDataContent>
      </Hint>
    );
  }

  render() {
    const {links, selectedNode, nodes} = this.props;
    const {activeLink, activeNode} = this.state;

    let highlightedSource, highlightedTarget: number;

    links.forEach((l: any, index: number) => {
      if (index === activeLink?.index) {
        highlightedSource = l.source;
        highlightedTarget = l.target;
      }
      l.opacity =
        index === activeLink?.index ? FOCUSED_LINK_OPACITY : BLURRED_LINK_OPACITY;
    });

    nodes.forEach((n: any, index: number) => {
      const {nameShown, _name} = n;
      const nameNodeHighlighted =
        index === selectedNode?.index || activeNode?.index === index;
      const nameLinkHighlighted =
        index === highlightedTarget || index === highlightedSource;

      let shortenedName = _name;
      if (_name.length > LABEL_MAX_CHARS) {
        shortenedName = _name.substring(0, LABEL_MAX_CHARS) + '…';
      }
      if (nameNodeHighlighted || nameLinkHighlighted) {
        shortenedName = _name;
      }
      n.name =
        nameShown || nameNodeHighlighted || nameLinkHighlighted ? shortenedName : '';
      n.color = nameNodeHighlighted ? theme.purple400 : theme.purple500;
    });

    const useLinks = links;
    /*
    if (selectedNode) {
      useLinks = links.filter(
        l => l.source === selectedNode.index || l.target === selectedNode.index
      );
    }
    */

    return (
      <SankeyContainer>
        <FlexibleSankey
          nodes={nodes}
          links={useLinks}
          height={VIS_HEIGHT}
          onValueClick={node => this.props.setSelectedNode(node)}
          onValueMouseOver={node => this.setActiveNode(node)}
          onValueMouseOut={() => this.setActiveNode(null)}
          onLinkMouseOver={node => this.setActiveLink(node)}
          onLinkMouseOut={() => this.setActiveLink(null)}
          style={{
            labels: {
              fontSize: `${LABEL_FONT_SIZE}px`,
            },
            rects: {},
          }}
        >
          {this._renderHint()}
        </FlexibleSankey>
        {selectedNode && (
          <SankeyReset
            size="xsmall"
            icon={
              <IconRefresh size="xs" onClick={() => this.props.setSelectedNode(null)} />
            }
          />
        )}
      </SankeyContainer>
    );
  }
}

const FlexibleSankey = makeWidthFlexible(Sankey);

const SankeyContainer = styled('div')`
  width: 100%;
  position: relative;
`;

const SankeyReset = styled(Button)`
  z-index: 2;
  position: absolute;
  bottom: 0;
  right: 0;
  margin-bottom: 20px;
  margin-right: 20px;
`;

const Circle = styled('span')`
  display: inline-block;
  margin-right: 5px;
  border-radius: 10px;
  width: 10px;
  height: 10px;
  background-color: ${p => p.color};
`;

const LabelContainer = styled('div')`
  display: flex;
  justify-content: space-between;
`;

type LabelProps = {
  label: string;
  value: string;
};

const TooltipLabel = (props: LabelProps) => {
  return (
    <LabelContainer>
      <span>
        <Circle color="#444674" />
        <StrongText>{props.label}</StrongText>
      </span>
      <span>{props.value}</span>
    </LabelContainer>
  );
};

const TooltipDataContent = styled('div')`
  position: absolute;
  display: block;
  border-style: solid;
  white-space: nowrap;
  z-index: 9999999;

  background: #302839;
  border-width: 0px;
  border-color: rgb(51, 51, 51);
  border-radius: 4px;
  color: rgb(255, 255, 255);
  font: 14px / 21px sans-serif;
  padding: 0px;
  pointer-events: none;

  transform: translate(-50%, -50%);
`;

const TooltipAuxiliary = styled('div')`
  border-top: 1px solid #645574;
  text-align: center;
  position: relative;
  width: auto;
  border-radius: 0 0 4px 4px;
  padding: 8px 16px;
`;

const StrongText = styled('span')`
  colro: ${p => p.theme.white};
`;

const TooltipSeries = styled('div')`
  color: #9585a3;
  font-family: 'Rubik', 'Avenir Next', sans-serif;
  padding: 8px 16px;
  border-radius: 4px 4px 0 0;

  strong {
    color: ${p => p.theme.white};
  }
`;

export default SessionVis;
