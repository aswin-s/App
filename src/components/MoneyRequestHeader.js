import React, {useState, useCallback, useEffect} from 'react';
import {withOnyx} from 'react-native-onyx';
import {View} from 'react-native';
import PropTypes from 'prop-types';
import lodashGet from 'lodash/get';
import HeaderWithBackButton from './HeaderWithBackButton';
import iouReportPropTypes from '../pages/iouReportPropTypes';
import * as ReportUtils from '../libs/ReportUtils';
import compose from '../libs/compose';
import * as Expensicons from './Icon/Expensicons';
import participantPropTypes from './participantPropTypes';
import styles from '../styles/styles';
import Navigation from '../libs/Navigation/Navigation';
import ROUTES from '../ROUTES';
import CONST from '../CONST';
import ONYXKEYS from '../ONYXKEYS';
import * as IOU from '../libs/actions/IOU';
import ConfirmModal from './ConfirmModal';
import useLocalize from '../hooks/useLocalize';
import MoneyRequestHeaderStatusBar from './MoneyRequestHeaderStatusBar';
import * as TransactionUtils from '../libs/TransactionUtils';
import reportActionPropTypes from '../pages/home/report/reportActionPropTypes';
import transactionPropTypes from './transactionPropTypes';
import useWindowDimensions from '../hooks/useWindowDimensions';
import themeColors from '../styles/themes/default';
import * as Report from '../libs/actions/Report';
import * as Session from '../libs/actions/Session';

const propTypes = {
    /** The report currently being looked at */
    report: iouReportPropTypes.isRequired,

    /** The policy which the report is tied to */
    policy: PropTypes.shape({
        /** Name of the policy */
        name: PropTypes.string,
    }),

    /** Personal details so we can get the ones for the report participants */
    personalDetails: PropTypes.objectOf(participantPropTypes).isRequired,

    /* Onyx Props */
    /** Session info for the currently logged in user. */
    session: PropTypes.shape({
        /** Currently logged in user email */
        email: PropTypes.string,
    }),

    /** The expense report or iou report (only will have a value if this is a transaction thread) */
    parentReport: iouReportPropTypes,

    /** The report action the transaction is tied to from the parent report */
    parentReportAction: PropTypes.shape(reportActionPropTypes),

    /** All the data for the transaction */
    transaction: transactionPropTypes,
};

const defaultProps = {
    session: {
        email: null,
    },
    parentReport: {},
    parentReportAction: {},
    transaction: {},
    policy: {},
};

function MoneyRequestHeader({session, parentReport, report, parentReportAction, transaction, policy, personalDetails}) {
    const {translate} = useLocalize();
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const moneyRequestReport = parentReport;
    const isSettled = ReportUtils.isSettled(moneyRequestReport.reportID);
    const isApproved = ReportUtils.isReportApproved(moneyRequestReport);
    const {isSmallScreenWidth, windowWidth} = useWindowDimensions();

    // Only the requestor can take delete the request, admins can only edit it.
    const isActionOwner = lodashGet(parentReportAction, 'actorAccountID') === lodashGet(session, 'accountID', null);

    const deleteTransaction = useCallback(() => {
        IOU.deleteMoneyRequest(lodashGet(parentReportAction, 'originalMessage.IOUTransactionID'), parentReportAction, true);
        setIsDeleteModalVisible(false);
    }, [parentReportAction, setIsDeleteModalVisible]);

    const isScanning = TransactionUtils.hasReceipt(transaction) && TransactionUtils.isReceiptBeingScanned(transaction);
    const threeDotsMenuItems = [
        ...(TransactionUtils.hasReceipt(transaction)
            ? []
            : [
                  {
                      icon: Expensicons.Receipt,
                      text: translate('receipt.addReceipt'),
                      onSelected: () => Navigation.navigate(ROUTES.EDIT_REQUEST.getRoute(report.reportID, CONST.EDIT_REQUEST_FIELD.RECEIPT)),
                  },
              ]),
        {
            icon: Expensicons.Trashcan,
            text: translate('reportActionContextMenu.deleteAction', {action: parentReportAction}),
            onSelected: () => setIsDeleteModalVisible(true),
        },
    ];

    if (!report.isPinned) {
        threeDotsMenuItems.unshift({
            icon: Expensicons.Pin,
            iconFill: themeColors.icon,
            text: translate('common.pin'),
            onSelected: Session.checkIfActionIsAllowed(() => Report.togglePinnedState(report.reportID, report.isPinned)),
        });
    } else {
        threeDotsMenuItems.unshift({
            icon: Expensicons.Pin,
            iconFill: themeColors.icon,
            text: translate('common.unPin'),
            onSelected: Session.checkIfActionIsAllowed(() => Report.togglePinnedState(report.reportID, report.isPinned)),
        });
    }

    const canModifyRequest = isActionOwner && !isSettled && !isApproved;

    useEffect(() => {
        if (canModifyRequest) {
            return;
        }

        setIsDeleteModalVisible(false);
    }, [canModifyRequest]);

    return (
        <>
            <View style={[styles.pl0]}>
                <HeaderWithBackButton
                    shouldShowAvatarWithDisplay
                    shouldShowPinButton={false}
                    shouldShowThreeDotsButton={canModifyRequest}
                    threeDotsMenuItems={threeDotsMenuItems}
                    threeDotsAnchorPosition={styles.threeDotsPopoverOffsetNoCloseButton(windowWidth)}
                    report={{
                        ...report,
                        ownerAccountID: lodashGet(parentReport, 'ownerAccountID', null),
                        ownerEmail: lodashGet(parentReport, 'ownerEmail', null),
                    }}
                    policy={policy}
                    personalDetails={personalDetails}
                    shouldShowBackButton={isSmallScreenWidth}
                    onBackButtonPress={() => Navigation.goBack(ROUTES.HOME, false, true)}
                />
                {isScanning && <MoneyRequestHeaderStatusBar />}
            </View>
            <ConfirmModal
                title={translate('iou.deleteRequest')}
                isVisible={isDeleteModalVisible}
                onConfirm={deleteTransaction}
                onCancel={() => setIsDeleteModalVisible(false)}
                prompt={translate('iou.deleteConfirmation')}
                confirmText={translate('common.delete')}
                cancelText={translate('common.cancel')}
                danger
            />
        </>
    );
}

MoneyRequestHeader.displayName = 'MoneyRequestHeader';
MoneyRequestHeader.propTypes = propTypes;
MoneyRequestHeader.defaultProps = defaultProps;

export default compose(
    withOnyx({
        session: {
            key: ONYXKEYS.SESSION,
        },
        parentReport: {
            key: ({report}) => `${ONYXKEYS.COLLECTION.REPORT}${report.parentReportID}`,
        },
        parentReportActions: {
            key: ({report}) => `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report ? report.parentReportID : '0'}`,
            canEvict: false,
        },
    }),
    // eslint-disable-next-line rulesdir/no-multiple-onyx-in-file
    withOnyx({
        transaction: {
            key: ({report, parentReportActions}) => {
                const parentReportAction = lodashGet(parentReportActions, [report.parentReportActionID]);
                return `${ONYXKEYS.COLLECTION.TRANSACTION}${lodashGet(parentReportAction, 'originalMessage.IOUTransactionID', 0)}`;
            },
        },
    }),
)(MoneyRequestHeader);
