// Copyright (c) 2021 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/

import { convertToHtml } from 'js/reactHelper';
import eventBus from 'js/eventBus';
import AwAvatar from 'viewmodel/AwAvatarViewModel';
import appCtxSvc from 'js/appCtxService';

export const awMarkupCellRenderFunction = ( props ) => {
    const comment = <div className='aw-markup-cellRichContent'>{convertToHtml( props.vmo.comment )}</div>;
    const source = props.vmo.userObj && props.vmo.userObj.typeIconURL;
    const comment_trust = appCtxSvc.ctx.reqMarkupCtx && appCtxSvc.ctx.reqMarkupCtx.commentName && appCtxSvc.ctx.reqMarkupCtx.commentName.toTrusted;

    return (


        <div className='aw-layout-flexRow'>
            <div className='aw-widgets-cellListCellImage' title={props.vmo.toShareInfo}>
                <AwAvatar size='small' source={source}></AwAvatar>
            </div>
            <div className='aw-markup-cellContent'>
                <div className='aw-widgets-cellListCellTitleBlock'>
                    <h3 className='aw-widgets-cellListCellTitle'>{props.vmo.displayname}</h3>
                    <label className='aw-widgets-cellListCellItemType aw-base-small'>{props.vmo.statusInfo}</label>
                </div>
                <div className='aw-widgets-cellListCellProperties'>
                    <label className='aw-widgets-propertyValue aw-base-small'>{props.vmo.date.toLocaleString()}</label>
                </div>
                <label visible-when='props.vmo.selected'>{comment_trust}</label>
                <div visible-when='!props.vmo.selected' className='aw-widgets-cellListCellProperties'>
                    <label className='aw-widgets-propertyValue aw-base-small'>{comment}</label>
                </div>
            </div>
        </div>
    );
};
