/*
 * Service to show native Requirement content viewer
 */
import universalViewerUtils from 'js/universalViewerUtils';
import AwViewerHeader from 'viewmodel/AwViewerHeaderViewModel';

/**
 * Requirement Content Viewer Render Function
 * @param {Object} viewModel the view model object
 * @returns {JSX.Element} react component
 */
export const awRequirementViewerRenderFn = function( { viewModel, data, elementRefList } ) {
    const reqViewerRef = elementRefList.get( 'reqViewerRef' );
    let viewerHeaderElem = '';
    let viewerElem = '';
    if( viewModel.viewerData ) {
        viewModel.viewerData.viewerRef = reqViewerRef;
        viewerHeaderElem =
            <div className='aw-viewerjs-header'>
                <AwViewerHeader data={viewModel.viewerData} context={{ fullScreenState:data.fullScreenState }}></AwViewerHeader>
            </div>
        ;
        const loadingDiv = <div className='aw-jswidgets-text'>{viewModel.loadingMsg}</div>;

        const mainStyle = {
            height: 'calc( 100% - 55px );'
        };
        const text =
            <div className='aw-requirements-mainPanel aw-base-scrollPanel aw-requirements-htmlHeaderFooterPreview' >
                <div className='aw-requirements-xrtRichText' ></div>
            </div>
        ;

        viewerElem = viewModel.data.loading ? loadingDiv : text;
    }

    const style = {
        height: viewModel.viewerHeight ? viewModel.viewerHeight : '100%'
    };

    return (
        <div ref={reqViewerRef} className='aw-viewer-gallery' style={style}>
            { viewerHeaderElem }
            { viewerElem }
        </div>
    );
};

/**
 * initialize the viewer using initViewer
 * @param {Object} viewerData viewer data
 * @param {Object} viewModel view model data object
 * @returns {Object} ViewModel data
 */
export const awRequirementViewerOnMount = function( viewerData, viewModel ) {
    viewModel.viewerData = viewerData;
    viewModel.dispatch( { path: 'data', value: { ...viewModel } } );

    // Get the element ( whole div tag )
    let element = viewerData.viewerRef?.current;
    if( element ) {
        universalViewerUtils.setResizeCallback( viewModel, resizeRequirementViewer );
        return universalViewerUtils.initViewer( element, viewModel, true );  // skipFmsTicketLoad = true
    }

    return viewModel.data;
};

/**
 * Cleanup all watchers and instance members when this scope is destroyed.
 * @param {Object} viewModel - view model object
 */
export const awRequirementViewerOnUnMount = function( viewModel ) {
    universalViewerUtils.cleanup( viewModel );
};

/**
 *
 * @param {Object} viewModel - view model object
 */
function resizeRequirementViewer( viewModel ) {
    if( viewModel && viewModel.element ) {
        var ele = viewModel.element;
        while ( ele !== null && !ele.classList.contains( 'aw-xrt-columnContentPanel' ) ) {
            ele = ele.parentElement;
        }
        if( ele && ele.clientHeight ) {
            var parentHeight = ele.clientHeight;
            var viewerHeight = parentHeight - 135 + 'px';
            // As per old directive aw-req-viewer, height need to set to viewer.
            // TODO BA - Need to validate this once this callback starts working.
        }
    }
}

export default {
    awRequirementViewerRenderFn,
    awRequirementViewerOnMount,
    awRequirementViewerOnUnMount
};
