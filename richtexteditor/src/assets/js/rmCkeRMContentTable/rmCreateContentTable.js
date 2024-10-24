import appCtxSvc from 'js/appCtxService';

/**
 * 
 * @param {Object} Container - Container element
 * @param {Object} editor - Editor instance
 */
export function createListItems( Container, editor ) {
    var documentData = editor.getData();
    var doc = document.createElement( 'div' );
    doc.innerHTML = documentData;
    var widgets = doc.getElementsByClassName( 'requirement' );

    var reqWidgets = [];
    for ( var i = 0; i < widgets.length; i++ ) {
        var widget = widgets[i];
        reqWidgets.push( widget );
    }
    for ( var wdgt in reqWidgets ) {
        var widget = reqWidgets[wdgt];
        var reqElement = widget.querySelector( 'div.aw-requirement-header h3' );
        var text;
        var reqId;
        if ( reqElement ) {
            reqId = widget.querySelector( 'span.aw-requirement-headerNonEditable' ).innerText;
            var reqPropElement = widget.querySelector( 'span.aw-requirement-properties' );
            text = reqId;
            if( reqPropElement ) {
                text += reqPropElement.innerText;
            }

            if ( text === null || text.trim() === '' ) {
                text = '&nbsp;';
            }else{
                var title = text.split( ' ', 1 );
                var reqNo = title[0].split( '.' );
                var space = 0;
                for ( var j = 0; j < reqNo.length; j++ ) {
                    //Some space for title
                    if ( wdgt === '0' ) {
                        continue;
                    }
                    space += 5;
                }
            }

            var uid = widget.getAttribute( 'revisionid' );
            if ( uid ) {
                var id = 'liid'.concat( uid );
                var liNode;
                var el = document.createElement( 'p' );
                if ( space === 0 || space === 5 ) {
                    el.innerHTML = liNode = '<li id=' + id + ' class="aw-requirement-tocUnderlineOnHover" style = font-weight:bold;padding-left:' + space + 'px;>' + text + '</li>';
                } else {
                    el.innerHTML = liNode = '<li id=' + id + ' class="aw-requirement-tocUnderlineOnHover" style = padding-left:' + space + 'px;>' + text + '</li>';
                }
                if ( Container ) {
                    Container.appendChild( el );
                } else {
                    Container.appendChild( el );
                }
            }
        }
    }
}
/**
* Method to return model fragment of html content
*/
export function ConvertHtmlToModel( htmlContent ) {
    const viewFragment = appCtxSvc.ctx.AWRequirementsEditor.editor.data.processor.toView( htmlContent );
    return appCtxSvc.ctx.AWRequirementsEditor.editor.data.toModel( viewFragment );
}
