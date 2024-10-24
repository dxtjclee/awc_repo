/*
 * Service to show native Requirement content View
 */
import eventBus from 'js/eventBus';
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import startEditGroupCommandService from 'js/startEditGroupCommandService';
import AwWindowService from 'js/awWindowService';
import requirementsUtils from 'js/requirementsUtils';

/**
 * Requirement Content View Render Function
 * @param {Object} props the view model object
 * @returns {Object} - Element
 */
export const awRequirementContentRenderFn = ( props ) => {
    const { viewModel, elementRefList, prop } = props;
    let requirementContentElement = elementRefList.get( 'requirementContentElement' );
    return (
        <div className='aw-requirements-mainPanel' ref={requirementContentElement}>
            <div className='aw-requirements-xrtRichText aw-layout-flexColumn'>
            </div>
        </div>
    );
};

/**
 * initialize the View
 * @param {Object} viewModel - view model data object
 * @param {Object} props - props
 * @param {Object} elementRefList - content element ref
 */
export const awRequirementContentOnMount = ( viewModel, props, elementRefList ) => {
    eventBus.publish( 'Arm0Documentation.contentLoaded' );
    if( props.prop ) {
        props.prop.id = _generateID();
    }

    let requirementContentElement = elementRefList.get( 'requirementContentElement' );
    if( requirementContentElement && requirementContentElement.current ) {
        viewModel.element = requirementContentElement.current;
        viewModel.dispatch( { path: 'data.element', value: requirementContentElement.current } );
    }

    if( !props['default-scroll'] ) {
        viewModel.element?.addEventListener( 'scroll', function() {
            // Close tracelink tootip, if any
            if( appCtxService.ctx.Arm0TraceLinkTooltipBalloonPopupVisible ) {
                eventBus.publish( 'Arm0TracelinkTooltip.closeTracelinkTooltip' );
                eventBus.publish( 'showActionPopup.close' );
            }
        } );
    }

    viewModel.element?.addEventListener( 'dblclick', function( ) {
        // Put Documentation tab in edit mode, on double click.
        // Double click should be applicable for only 'Documentation' tab not for 'Preview'
        let subCtx = props.subpanelcontext;
        if( subCtx && ( subCtx.context && _isDocumentationTabActive( subCtx.context )  || subCtx.pageContext && _isDocumentationTabActive( subCtx )  ) ) {
            startEditGroupCommandService.execute( '', appCtxService.ctx.ViewModeContext.ViewModeContext );
        }
    } );

    // This setups listener on window for resize
    AwWindowService.instance.addEventListener( 'resize', function( ) {
        resizeContentViewerCaller( viewModel, props );
    } );

    resizeContentViewerCaller( viewModel, props );
};

/**
 * Cleanup all watchers and instance members when this scope is destroyed.
 * @param {Object} viewModel - view model object
 */
export const awRequirementContentOnUnMount = function( viewModel ) {
    eventBus.publish( 'Arm0Documentation.contentUnloaded' );
};

/**
 * @returns {String} - Return random id
 */
function _generateID() {
    return 'rm-viewer-' + Math.random().toString( 36 ).substr( 2, 9 );
}

/**
 *
 * @param {Object} viewModel - view model object
 * @param {Object} props - props
 */
export const updateContentData = function( viewModel, props ) {
    var mainPanelElement = viewModel.element;
    var reqContentElement = mainPanelElement.getElementsByClassName( 'aw-requirements-xrtRichText' );
    reqContentElement[0].innerHTML = props.prop.dbValue;

    if( !_.includes( reqContentElement[ 0 ].className, 'aw-richtexteditor-documentPaper' ) && props['apply-border'] ) {
        reqContentElement[ 0 ].className += ' aw-richtexteditor-documentPaper aw-richtexteditor-document aw-richtexteditor-documentPanel';
    }

    _addEventOnOLEObjects( reqContentElement[ 0 ], props );

    // Render Equation in React DOM
    requirementsUtils.loadEquationAsReactComponents( reqContentElement[ 0 ] );
};

/**
 * Sets the viewer height
 *
 * @param {Object} viewModel - view model object
 */
function setViewerDimensions( viewModel ) {
    var height = 0;
    var width = 0;
    if( viewModel.element ) {
        if( appCtxService.ctx.selected && appCtxService.ctx.selected.modelType.typeHierarchyArray.indexOf( 'Arm0RequirementSpecElement' ) < -1 && appCtxService.ctx.xrtPageContext.secondaryXrtPageID === 'tc_xrt_Overview' ) {
            height = 350;
        }
        // this means panel section of UV is in the view
        else if( window.innerHeight > viewModel.element.offsetTop ) {
            height = window.innerHeight - viewModel.element.offsetTop - 14;
            height = height > 300 ? height : 300;
        } else {
            // this means panel section of UV is drop downed and have to scroll to view it.
            height = window.innerHeight - 120; // 60px from header + 60px from footer
        }

        if( viewModel.panelSection && viewModel.panelSection.clientWidth && viewModel.panelSection.clientWidth > 0 ) {
            width = viewModel.panelSection.clientWidth - 40;
        } else if( viewModel.element.parentElement && viewModel.element.parentElement.clientWidth && viewModel.element.parentElement.clientWidth > 0 ) {
            width = viewModel.element.parentElement.clientWidth - 10;
        }

        width = width > 300 ? width : 300;
    }

    viewModel.viewerHeight =  height - 60  + 'px'; //reserving 30 pixels for viewer header labels + + label text when clicked on labels
    viewModel.viewerPanelHeight = height + 'px';
    viewModel.viewerPanelWidth = width + 'px';
    viewModel.viewerWidth =  width - 23  + 'px'; //reserving 23 pixels for scroll bar displayed on hover if applicable
}

/**
 * Implements promise for window resize event
 *
 * @param {Object} viewModel - view model object
 * @param {Object} props - props
 */
function resizeTimer( viewModel, props ) {
    viewModel.resizePromise = setTimeout( function() {
        setViewerDimensions( viewModel );

        if( viewModel.element ) {
            resizeContentViewer( viewModel, props, viewModel.viewerPanelWidth, viewModel.viewerPanelHeight );
        }
    }, 100 );
}

/**
 * Implements handler for window resize event
 *
 * @param {Object} viewModel - view model object
 * @param {Object} props - props
 */
export const resizeContentViewerCaller = function( viewModel, props ) {
    if( viewModel.resizePromise ) {
        clearTimeout( viewModel.resizePromise );
    }
    resizeTimer( viewModel, props );
};

/**
 * @param {Object} viewModel - view model object
 * @param {Object} props - props
 * @param {*} viewerWidth -
 * @param {*} viewerHeight -
 */
function resizeContentViewer( viewModel, props, viewerWidth, viewerHeight ) {
    var MIN_SCROLL_POS = 2;
    var mainPanelElement = viewModel.element;
    var reqContentElement = mainPanelElement.getElementsByClassName( 'aw-requirements-xrtRichText' );

    if( props.subPanelContext ) {
        var currentElement = mainPanelElement;
        while( currentElement !== null && !currentElement.classList.contains( 'aw-xrt-columnContentPanel' )  ) {
            currentElement = currentElement.parentElement;
        }
        if( currentElement && currentElement.clientHeight && currentElement.clientWidth ) {
            var height = currentElement.clientHeight;
            var width = currentElement.clientWidth;
            viewModel.viewerHeight =  height - 60  + 'px'; //reserving 30 pixels for viewer header labels + + label text when clicked on labels
            viewModel.viewerPanelHeight = height - 60  + 'px';
            viewModel.viewerPanelWidth = width + 'px';
            viewModel.viewerWidth =  width - 23  + 'px'; //reserving 23 pixels for scroll bar displayed on hover if applicable
        }
    }

    if( !props['default-scroll'] ) {
        var reqContentHeight = 0;

        if( reqContentElement && reqContentElement.length > 0 ) {
            reqContentHeight = reqContentElement[ 0 ].scrollHeight;
        }

        if( reqContentHeight > 0 && reqContentHeight <= parseInt( viewerHeight ) ) {
            mainPanelElement.style.height = reqContentHeight - MIN_SCROLL_POS * 2 + 'px';
            mainPanelElement.style.overflow = 'auto';
            mainPanelElement.scrollTop = MIN_SCROLL_POS;
            return;
        }
        mainPanelElement.style.overflow = 'auto';
    } else {
        mainPanelElement.style.overflow = 'auto';
    }
    if( props.subPanelContext ) {
        mainPanelElement.style.height = viewModel.viewerPanelHeight;
    }else {
        mainPanelElement.style.height = viewerHeight;
    }
}

/**
 * OLE object click listener
 *
 * @param {Event} event The event
 */
function onClickOnOLEObject( event, props ) {
    var target = event.currentTarget;
    var oleID = target.getAttribute( 'oleid' );
    var oleObjectUID = target.getAttribute( 'oleObjectUID' );

    var eventData = {
        oleid: oleID,
        oleObjectUID: oleObjectUID,
        viewerid: props.prop.id
    };

    eventBus.publish( 'oleObjectClickedRM', eventData );
}

/**
 * Add click event on OLE Objects.
 *
 * @param {Object} rmElement RM Element
 */
var _addEventOnOLEObjects = function( rmElement, props ) {
    var imgs = rmElement.getElementsByTagName( 'img' );
    for( var ii = 0; ii < imgs.length; ii++ ) {
        var oleElement = imgs[ ii ];

        if( oleElement.getAttribute( 'oleid' ) ) {
            oleElement.addEventListener( 'click', function( ) {
                onClickOnOLEObject( event, props );
            } );
        }
    }
};

/**
 * @returns {boolean} true, if current active tab is 'Documentation'
 */
let _isDocumentationTabActive = function( context ) {
    if( context && context.pageContext && ( context.pageContext.primaryActiveTabId === 'tc_xrt_Documentation' || context.pageContext.secondaryActiveTabId === 'tc_xrt_Documentation' ) ) {
        return true;
    }
    return false;
};

export default {
    awRequirementContentRenderFn,
    awRequirementContentOnMount,
    awRequirementContentOnUnMount,
    updateContentData,
    resizeContentViewerCaller
};
