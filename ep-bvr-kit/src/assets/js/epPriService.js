// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for rendering EpPri component
 *
 * @module js/epPriService
 */

import eventBus from 'js/eventBus';
import AwIcon from 'viewmodel/AwIconViewModel';
import MfeMessage from 'viewmodel/MfeMessageViewModel';
import epPriUtils from 'js/epPriUtils';
import $ from 'jquery';
import epBalancingLabelsService from 'js/epBalancingLabelsService';
import mfeContentPanelUtil from 'js/mfeContentPanelUtil';
import MfeLoadingMessage from 'viewmodel/MfeLoadingMessageViewModel';
import cdm from 'soa/kernel/clientDataModel';

import _ from 'lodash';
import epTimeUnitsService from 'js/epTimeUnitsService';

let root = undefined;
let size = undefined;
let arrowData = undefined;
let arrow = undefined;
let subscriptions = [];

const PORT_OFFSET = epPriUtils.UI_CONSTANTS.PORT_SIZE / 2 + 1;

/**
 * @param {*} elementRefList ref items
 */
export function initialize( elementRefList ) {
    root = elementRefList.get( 'root' ).current;
    updateSize();
}

/**
 */
export function destroy() {
    root = undefined;
    $( window ).off( 'resize', resize );
    $( window ).off( 'mouseup', onMouseUp );
    _.forEach( subscriptions, subscription => eventBus.unsubscribe( subscription ) );
    subscriptions = [];
}

const resize = () => {
    size.update( { width: _.floor( root.getBoundingClientRect().width ) } );
};

const handleProductBOPToggle = ( eventData ) => {
    if( eventData.name === 'ep.balancingShowProductBOP' ) {
        resize();
    }
};

const updateSize = () => {
    if( root ) {
        resize();
        $( window ).on( 'resize', resize );
        $( window ).on( 'mouseup', onMouseUp );
        subscriptions.push( eventBus.subscribe( 'aw-splitter-update', resize ) );
        subscriptions.push( eventBus.subscribe( 'appCtx.update', handleProductBOPToggle ) );
    }
};

/**
 * Prepare operations Sequence containers
 * @param {*} line line
 * @param {*} station station
 * @param {*} processResources processResources
 * @param {*} selectedProcessResource pr/unassigned
 * @returns {Object} operationSequenceData
 */
export function prepareOperationsSequenceContainers( line, station, processResources, selectedProcessResource ) {
    return epPriUtils.prepareContainers( line, station, processResources, selectedProcessResource );
}

/**
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export function epPriRender( props ) {
    const operationSequenceData = props.viewModel.operationSequenceData;
    const isProcessResourceSelected = props.viewModel.conditions.isProcessResourceSelected;
    size = props.fields.size;
    arrowData = props.fields.arrowData;

    let message = undefined;
    if( operationSequenceData ) {
        if( !props.station ) {
            message = props.viewModel.messages.noStationSelected;
        } else if( operationSequenceData.lineTaktTime === 0 ) {
            message = props.viewModel.messages.noTaktTimeInTheLine;
        } else if( !props.viewModel.conditions.stationHasProcessResources ) {
            message = props.viewModel.messages.noProcessResourceInStation;
        } else if( arrowData && arrowData.showUpdateMessage ) {
            message = props.viewModel.messages.updateOperationSequenceMessage;
        }
    }

    const hidePri = props.hidePri === 'true';
    const showMessage = message && ( !hidePri || !props.station || !props.viewModel.conditions.stationHasProcessResources );
    const showChart = operationSequenceData && !hidePri && !message;
    return (
        <div className={'aw-epPri-root' + ( isProcessResourceSelected ? ' aw-epPri-rootDisabledCursor' : '' )} ref={props.elementRefList.get( 'root' )}>
            { !showMessage && !showChart && <MfeLoadingMessage></MfeLoadingMessage> }
            { showMessage && <MfeMessage subPanelContext={message}></MfeMessage> }
            { showChart && renderChart( props ) }
        </div>
    );
}

// todo:
// localizations
const renderChart = ( props ) => {
    const isProcessResourceSelected = props.viewModel.conditions.isProcessResourceSelected;
    const operationSequenceData = props.viewModel.operationSequenceData;
    const svgWrapperWidth = props.fields.size.width - 240;
    const actualWidth = svgWrapperWidth - 2;
    const scalingRatio = operationSequenceData.taktTime && operationSequenceData.taktTime !== 0 ? svgWrapperWidth * 0.75 / operationSequenceData.taktTime : 0;
    const rendering = epPriUtils.recalculateData( operationSequenceData, scalingRatio, props.i18n.operatorTime, actualWidth );
    rendering.svgWrapperWidth = _.floor( svgWrapperWidth );

    return (
        <div className={'aw-epPri-panelWrapper' + ( isProcessResourceSelected ? ' aw-epPri-panelWrapperDisabled' : '' )}>
            {renderProcessResourcesContainer( operationSequenceData, props.i18n )}
            {renderSVG( props, operationSequenceData, rendering )}
        </div>
    );
};

const renderProcessResourcesContainer = ( operationSequenceData, i18n ) => {
    return (
        <div className='mfgGeneralUI-container-absoluteContainer'>
            {operationSequenceData.containers.map( container => renderProcessResource( container, i18n ) )}
        </div>
    );
};

const renderProcessResource = ( container, i18n ) => {
    const time = stringToFloat( container.time );
    const title = `${container.name} ${i18n.time}: ${time} ${epTimeUnitsService.getCurrentTimeUnitShort()}`;
    return (
        <div key={container.id} className={'aw-epPri-container' + ( container.isSelected ? ' aw-epPri-selectedProcessResource' : '' )} style={{ top: container.y }}>

            <div className='aw-epPri-namePanel' title={container.name}>
                {container.shared && <AwIcon iconId='cmdShare24'></AwIcon>}
                <div className='aw-epPri-name aw-epPri-textEllipses'>{container.name}</div>
                {container.capacity < 100 && <div className='aw-epPri-containerCapacity'>{container.capacity}%</div>}
            </div>
            <div title={title} className='aw-epPri-timePanel'>
                <AwIcon iconId='cmdTime'></AwIcon>
                <div className='aw-epPri-time'>{time}</div>
            </div>
        </div>
    );
};

// I skipped {renderItemWrappers()} - this is for drag and drop
const renderSVG = ( props, operationSequenceData, rendering ) => {
    return (
        <div className='aw-epPri-svgWrapper'>
            <svg className='aw-epPri-svg' style={{ width: rendering.svgWrapperWidth, height: operationSequenceData.containers.length * 50 + 20 }}
                onMouseUp={onMouseUp}
                onMouseMove={onMouseMoved}
            >
                {renderDefs()}
                {renderContainers( operationSequenceData )}
                {renderItems( props, operationSequenceData )}
                {renderArrows( operationSequenceData, props.subPanelContext )}
                {renderIndicatorLines( operationSequenceData, rendering.positions, props.i18n )}
            </svg>
        </div>
    );
};

const renderDefs = () => {
    return (
        <defs>
            <marker id='existingArrowHead' refX='0' refY='5' markerWidth='5' markerHeight='9'>
                <path d='M0,0 L0,9 L5,4.5 z'
                    className='aw-epPri-arrowHead aw-epPri-existingArrowHead'></path>
            </marker>
            <marker id='hoveredArrowHead' refX='0' refY='5' markerWidth='5' markerHeight='9'>
                <path d='M0,0 L0,9 L5,4.5 z'
                    className='aw-epPri-arrowHead aw-epPri-hoveredArrowHead'></path>
            </marker>
            <marker id='selectedArrowHead' refX='0' refY='5' markerWidth='5' markerHeight='9'>
                <path d='M0,0 L0,9 L5,4.5 z'
                    className='aw-epPri-arrowHead aw-epPri-selectedArrowHead'></path>
            </marker>
            <marker id='axis' refX='0' refY='6' markerWidth='1' markerHeight='11'>
                <line x1='1' x2='1' y1='0' y2='11' className='aw-epPri-axisLine'></line>
            </marker>
            <path id='externalArrowHead' d='M 0 0 L 6 5.5 L 0 11 Z' className='aw-epPri-externalArrowHead'>
            </path>
        </defs>
    );
};

const renderContainers = ( operationSequenceData ) => {
    return (
        <g>
            {operationSequenceData.containers.map( container =>
                <line key={container.id} className='aw-epPri-containerAxis'
                    x1={container.axisX1} x2={container.axisX2}
                    y1={container.axisY} y2={container.axisY}
                    markerEnd='url(#axis)' markerStart='url(#axis)'>
                </line>
            )}
        </g>
    );
};

/**
 * Action on sequence click
 * @param {*} props props
 * @param {*} item item
 * @returns {Function} click handler
 */
const onSequenceClick = ( props, item ) => ( event ) => {
    event.preventDefault();
    if ( !item.external && ( !props.fields.selectedOperation.getValue().id || props.fields.selectedOperation.getValue().id !== item.id ) ) {
        props.fields.selectedOperation.update( item );
        props.selection.update( { operation: cdm.getObject( item.id ) } );
    }
};

// I remove: item selection
export const renderItems = ( props, operationSequenceData ) => {
    const outportItem = arrowData.getValue().outportItem;
    const inportItem = arrowData.getValue().inportItem;

    return (
        <g>
            {operationSequenceData.containers.map( container =>
                container.items.map(  item =>
                    <g key={item.id}>
                        <rect onClick={onSequenceClick( props, item )}
                            className={'aw-epPri-itemWrapper aw-epPri-item ' + ( props.fields.selectedOperation.id === item.id ? 'aw-epPri-itemSelected' : '' ) + ( item.external ? 'aw-epPri-externalItem' : '' )}
                            x={item.x} y={item.y} width={item.width} height={item.height}
                            item-id={item.id}
                            onMouseOver={( e ) => { onMouseMoveItem( e, item ); }}
                            onMouseMove={( e ) => { onMouseMoveItem( e, item ); }}
                            onMouseDown={( e ) => { onMouseDownItem( e, item, operationSequenceData ); }}
                            onMouseOut={( e ) => { onMouseOutItem( e, item ); }}
                        >
                            <title>{`${item.name} | ${item.allocatedTime} ${epTimeUnitsService.getCurrentTimeUnitShort()}`}</title>
                        </rect>


                        {!item.valid && <rect className='aw-epPri-exceedingItem'
                            x={item.x} y={item.y} width={item.width} height={3}>
                        </rect>}
                        {item.external && item.hasExternalFlow && item.hasWaitTimeBefore &&
                        <g>
                            <use href='#externalArrowHead' y={container.y + 15} x={item.x}></use>
                            {item.hover && <line className='aw-epPri-externalArrow' x1={item.x - 5}
                                x2={item.x} y1={container.y + 21}
                                y2={container.y + 21}>
                            </line>}
                        </g>}
                    </g>
                )
            )}
            {operationSequenceData.containers.map( container =>
                container.gaps.map( gap =>
                    <g key={gap.id}>
                        <rect className='aw-epPri-gap' x={gap.x} y={gap.y}
                            width={gap.width} height='26px'></rect>
                        <line className='aw-epPri-gapBorder' x1={gap.x}
                            x2={gap.x + gap.width} y1={gap.y + 1} y2={gap.y + 1}></line>
                        <line className='aw-epPri-gapBorder' x1={gap.x}
                            x2={gap.x + gap.width} y1={gap.y + 26} y2={gap.y + 26}></line>
                        {gap.start === 0 && <line className='aw-epPri-gapBorder' x1={gap.x + 1}
                            x2={gap.x + 1} y1={gap.y} y2={gap.y + 26}></line>}
                    </g>
                )
            )}
            {operationSequenceData.containers.map( container =>
                container.items.map( item =>
                    <g key={item.id}>
                        {( item.inport.visible || inportItem && inportItem === item.id && !item.external ) && <rect className='aw-epPri-port'
                            width='7px' height='7px'
                            transform={`translate(${item.inport.x} ${item.inport.y - PORT_OFFSET}) rotate(45)`} />}
                        { outportItem && outportItem === item.id && !item.external  && <rect className='aw-epPri-port'
                            width='7px' height='7px'
                            transform={`translate(${item.outport.x} ${item.outport.y - PORT_OFFSET}) rotate(45)`}
                            onMouseDown={( e ) => { onMouseDownItem( e, item, operationSequenceData, true ); } }
                            port-id={item.id}/>}
                    </g>
                )
            )}
        </g>
    );
};

/*
I skipped:

<!-- Invisible hovered arrow -->
<!-- Invisible selected arrow -->
<!-- Invisible selection for existing arrows -->

*/
const renderArrows = ( operationSequenceData, subPanelContext ) => {
    const arrowIndications = arrowData.getValue().arrowIndications;
    return (
        <g>
            {operationSequenceData.arrows.map( ( arrow, index )=>
                <g>
                    <path key={arrow.id}
                        className='aw-epPri-arrow aw-epPri-existingArrow' d={arrow.d}
                        markerEnd='url(#existingArrowHead)' />
                    { arrowIndications.hovered && <path
                        className='aw-epPri-arrow aw-epPri-hoveredArrow'
                        d={arrowIndications.hovered.d} markerEnd='url(#hoveredArrowHead)' />}

                    { arrowIndications.selected && <path
                        className='aw-epPri-arrow  aw-epPri-selectedArrowHead'
                        d={arrowIndications.selected.d} markerEnd='url(#selectedArrowHead)' />
                    }
                    <path className='aw-epPri-existingArrowOverlay'
                        d={arrow.d}
                        onClick={( e ) => { arrowClicked( e, index, operationSequenceData, subPanelContext ); }}
                        onMouseOver={ ( ) => { mouseOverArrow(  index, operationSequenceData ); }}
                        onMouseOut={mouseOutArrow}  />

                </g>
            )}

            { arrow && <polyline  className='aw-epPri-arrow aw-epPri-currentArrow'
                points={arrow.current.x1 + ',' + arrow.current.y1 + ' ' + arrow.current.x1 + ',' + arrow.current.middleY + ' ' + arrow.current.x2 + ',' + arrow.current.middleY + ' ' + arrow.current.x2 + ',' + arrow.current.y2} />
            }

        </g>
    );
};

//<text
const renderIndicatorLines = ( operationSequenceData, rendering, i18n ) => {
    return (
        <g className='aw-epPri-indicatorLines'>
            <g>
                {operationSequenceData.containers.map( container =>
                    <g key={container.id}>
                        {rendering.taktTimeX &&
                            <line className={container.capacity < 100 ? 'aw-epPri-secondaryTaktTimeLine' : 'aw-epPri-mainTaktTimeLine'}
                                x1={rendering.taktTimeX} x2={rendering.taktTimeX}
                                y1={container.axisY - 35} y2={container.axisY + 5} />}
                        {rendering.taktTimeX && container.capacity < 100 &&
                            <g>
                                <line className='aw-epPri-mainTaktTimeLine'
                                    x1={rendering.taktTimeX * container.capacity / 100}
                                    x2={rendering.taktTimeX * container.capacity / 100}
                                    y1={container.axisY - 35} y2={container.axisY + 5} />
                                <line className='aw-epPri-lineOverlay'
                                    x1={rendering.taktTimeX * container.capacity / 100}
                                    x2={rendering.taktTimeX * container.capacity / 100}
                                    y1={container.axisY - 35} y2={container.axisY + 5}>
                                    <title>Process Resource Takt Time: {container.taktTime}</title>
                                </line>
                            </g>}

                        {container.availableTimeX &&
                            <text
                                className={container.availableTime < 0 ? 'aw-epPri-exceedingTime' : 'aw-epPri-availableTime'}
                                y={container.nameY}
                                x={container.availableTimeX}>{stringToFloat( container.availableTime )}
                                <title> {container.availableTime  < 0 ? i18n.exceedingTime : i18n.availableTime} {stringToFloat( container.availableTime )} {epTimeUnitsService.getCurrentTimeUnitShort()}
                                </title>
                            </text>}
                    </g>
                )}
                {rendering.taktTimeX &&
                    <line className='aw-epPri-lineOverlay' x1={rendering.taktTimeX}
                        x2={rendering.taktTimeX} y1={rendering.indicatorLineStart}
                        y2={rendering.indicatorLineEnd}>
                        <title>{`${i18n.stationTaktTime} ${stringToFloat( operationSequenceData.taktTime )} ${epTimeUnitsService.getCurrentTimeUnitShort()}`}</title>
                    </line>}
                {rendering.taktTimeTextX &&
                    <text className='aw-epPri-taktTimeText' x={rendering.taktTimeTextX}
                        y={rendering.indicatorLineEnd + 15}>{stringToFloat( operationSequenceData.taktTime )}
                        <title>{`${i18n.stationTaktTime} ${stringToFloat( operationSequenceData.taktTime )} ${epTimeUnitsService.getCurrentTimeUnitShort()}`}</title>
                    </text>}
            </g>
            {rendering.cycleTimeX &&
                <g className={operationSequenceData.cycleTime > operationSequenceData.taktTime ? 'aw-epPri-cycleTimeExceeding' : 'aw-epPri-cycleTimeNormal'}>
                    <line className='aw-epPri-cycleTimeLine' x1={rendering.cycleTimeX}
                        x2={rendering.cycleTimeX} y1={rendering.indicatorLineStart}
                        y2={rendering.indicatorLineEnd}>
                    </line>
                    <line className='aw-epPri-lineOverlay' x1={rendering.cycleTimeX}
                        x2={rendering.cycleTimeX} y1={rendering.indicatorLineStart}
                        y2={rendering.indicatorLineEnd}>
                        <title>{`${i18n.cycleTime} ${stringToFloat( operationSequenceData.cycleTime )} ${epTimeUnitsService.getCurrentTimeUnitShort()}`}</title>
                    </line>
                    <text x={rendering.cycleTimeTextX}
                        y={rendering.indicatorLineEnd + 15}>{stringToFloat( operationSequenceData.cycleTime )}
                        <title>{`${i18n.cycleTime} ${stringToFloat( operationSequenceData.cycleTime )} ${epTimeUnitsService.getCurrentTimeUnitShort()}`}</title>
                    </text>
                </g>}
        </g>
    );
};

/**
 * Set operation to selected
 * @param {*} selectedOperationField fields
 * @param {*} operationSequenceData operationSequenceData
 * @param {*} selectedOperation selectedOperation
 */
export const setSelectedOperation = ( selectedOperationField, operationSequenceData, selectedOperation ) => {
    let isOperationSelected = false;

    if( selectedOperation && selectedOperation[ 0 ] ) {
        if ( selectedOperation[ 0 ].uid === selectedOperationField.getValue().id ) {
            isOperationSelected = true;
        } else {
            _.forEach( operationSequenceData.containers, container => {
                _.forEach( container.items, item => {
                    if( container.id === selectedOperation[ 0 ].props.Mfg0processResource.value && selectedOperation[ 0 ].uid === item.id ) {
                        isOperationSelected = true;
                        selectedOperationField.update( item );
                    }
                } );
            } );
        }
    }

    if( !isOperationSelected ) {
        resetSelectedOperation( selectedOperationField );
    }
};

/**
 * Reset selected operation
 * @param {*} selectedOperationField selectedOperationField
 */
export const resetSelectedOperation = ( selectedOperationField ) => {
    selectedOperationField.update( {} );
};

/**
 *
 * @param {Object} flowData -
 */
export function deleteFlow( flowData ) {
    var flowObject = {
        fromId: flowData.selected.fromID,
        toId: flowData.selected.toID
    };
    epPriUtils.deleteFlow( flowObject, arrowData );
}

const onMouseOutItem = ( event, item ) => {
    if( !epPriUtils.isMouseOnPortArea( event, item ) ) {
        arrowData.outportItem = '';
        arrowData.update( arrowData );
    }
};

const onMouseMoveItem = ( event, item ) => {
    if ( !isDrawingArrow() ) {
        if( epPriUtils.isMouseOnPortArea( event, item ) && !item.external ) {
            arrowData.outportItem = item.id;
        } else {
            arrowData.outportItem = '';
        }
    }

    arrowData.update( arrowData );
};

const onMouseDownItem = ( event, item, operationSequenceData, fromPort ) => {
    if( ( fromPort || epPriUtils.isMouseOnPortArea( event, item ) ) && !item.external ) {
        arrow = epPriUtils.getArrowHelper( operationSequenceData, arrowData );
        arrow.startArrow( event, item, fromPort );
        arrowData.outportItem = item.id;
        arrowData.update( arrowData );
    }
};

const isDrawingArrow = () => {
    return arrow !== undefined;
};

const onMouseUp = ( e ) => {
    e.stopPropagation();
    if( isDrawingArrow() ) {
        if( arrow.isArrowValid() ) {
            epPriUtils.addFlow( arrow.current, arrowData );
        }
        arrow.close();
        arrow = undefined;

        arrowData.update( {
            inportItem: '',
            outportItem: '',
            showUpdateMessage: false,
            arrowIndications: {
                selected: '',
                hovered: ''
            }
        } );
    }
};

const onMouseMoved = ( event ) => {
    if( isDrawingArrow() ) {
        arrow.drawArrow( event );
    }
};

const arrowClicked = ( e, arrowIndex, operationSequenceData, subPanelContext ) => {
    e.stopPropagation();
    const selectedArrow = operationSequenceData.arrows[ arrowIndex ];
    arrowData.arrowIndications.selected = arrowData.arrowIndications.selected === selectedArrow ? undefined : selectedArrow;
    arrowData.update( arrowData );
    mfeContentPanelUtil.setCommandContext( subPanelContext, {
        arrowIndications: arrowData.arrowIndications
    } );
};

const mouseOverArrow = ( arrowIndex, operationSequenceData ) => {
    const arrow = operationSequenceData.arrows[ arrowIndex ];
    arrowData.arrowIndications.hovered = arrow;
    arrowData.update( arrowData );
};

const mouseOutArrow = () => {
    arrowData.arrowIndications.hovered = '';
    arrowData.update( arrowData );
};

const stringToFloat = ( value ) => {
    return epBalancingLabelsService.stringToFloat( value );
};
