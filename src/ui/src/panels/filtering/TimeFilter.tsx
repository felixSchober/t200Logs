import * as React from "react";
import { VSCodeTextField, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react";
import { Flex } from "../../common/Flex";
import { useSendAndReceive } from "../../service/useSendAndReceive";
import { useDebounce } from "../../common/useDebounce";
import { useMessageSubscription } from "../../service/useMessageSubscription";
import { useLogger } from "../../service/useLogger";

type TimeFilterState = {
    from: string;
    till: string;
};

export const TimeFilter: React.FC = () => {
    const [filterOutElementsWithoutTime, setFilterOutElementsWithoutTime] = React.useState(true);
    const [timeFilter, setTimeFilter] = React.useState<TimeFilterState>({ from: "", till: "" });
    const [timeFilterLastUpdated, setTimeFilterLastUpdated] = React.useState<TimeFilterState>({ from: "", till: "" });
    const debouncedTimeFilter = useDebounce(timeFilter, 1000);
    const { send: sendTime } = useSendAndReceive("filterTime", "updateNumberOfActiveFilters");
    const { send: sendFilterNoEventTime } = useSendAndReceive("filterNoEventTime", "updateNumberOfActiveFilters");
    const { send: sendSessionIdFilter } = useSendAndReceive("filterSessionId", "updateNumberOfActiveFilters");
    const subscriptionTimeFilters = useMessageSubscription("updateTimeFilters");
    const { log } = useLogger("TimeFilter");
    const summary = useMessageSubscription("getSummaryResponse");
    const onCheckboxChange = React.useCallback(
        (event: Event | React.FormEvent<HTMLElement>) => {
            const target = event.target as HTMLInputElement;
            const value = target.checked;
            setFilterOutElementsWithoutTime(value);
            sendFilterNoEventTime({ removeEntriesWithNoEventTime: value });
        },
        [sendFilterNoEventTime]
    );

    const isSessionIdDefined = summary?.summary?.sessionId !== undefined;

    const onTextFieldChange = React.useCallback((event: Event | React.FormEvent<HTMLElement>) => {
        const target = event.target as HTMLInputElement;
        const value = target.value;
        const name = target.name;
        switch (name) {
            case "from":
                setTimeFilter(prev => ({ ...prev, from: value }));
                break;
            case "till":
                setTimeFilter(prev => ({ ...prev, till: value }));
                break;
            default:
                break;
        }
    }, []);

    const onSessionIdFilterChange = React.useCallback(
        (event: Event | React.FormEvent<HTMLElement>) => {
            const target = event.target as HTMLInputElement;
            const value = target.checked;
            const name = target.name;
            switch (name) {
                case "filter_session_id":
                    const sessionId = summary?.summary?.sessionId;
                    if (!sessionId) {
                        return;
                    }
                    sendSessionIdFilter({ isChecked: value, sessionId: sessionId });
                    break;
                default:
                    break;
            }
        },
        [sendSessionIdFilter, summary]
    );

    React.useEffect(() => {
        console.log(
            "debouncedTimeFilter",
            debouncedTimeFilter,
            "timeFilterLastUpdated",
            timeFilterLastUpdated,
            "subscriptionTimeFilters",
            subscriptionTimeFilters
        );

        // only execute if
        // - the debounced filter has changed
        // and
        // - is not the same as the last updated filter
        // AND is not equal to the subscriptionTimeFilters
        const shouldUpdate =
            debouncedTimeFilter.from !== timeFilterLastUpdated.from ||
            (debouncedTimeFilter.till !== timeFilterLastUpdated.till &&
                !(
                    debouncedTimeFilter.from === subscriptionTimeFilters?.fromDate &&
                    debouncedTimeFilter.till === subscriptionTimeFilters?.tillDate
                ));
        if (shouldUpdate) {
            setTimeFilterLastUpdated(debouncedTimeFilter);
            sendTime({ fromDate: debouncedTimeFilter.from ?? null, tillDate: debouncedTimeFilter.till ?? null });
        } else {
            console.log("skipping sendTime");
        }
    }, [debouncedTimeFilter, timeFilterLastUpdated, subscriptionTimeFilters, sendTime]);

    React.useEffect(() => {
        if (subscriptionTimeFilters) {
            setTimeFilter(prev => {
                // do nothing if the time filters are the same
                if (prev.from === subscriptionTimeFilters.fromDate && prev.till === subscriptionTimeFilters.tillDate) {
                    return prev;
                }

                // if the time filters are different, update the time filter state
                const from =
                    subscriptionTimeFilters.fromDate === null || subscriptionTimeFilters.fromDate === undefined
                        ? prev.from
                        : subscriptionTimeFilters.fromDate;
                const till =
                    subscriptionTimeFilters.tillDate === null || subscriptionTimeFilters.tillDate === undefined
                        ? prev.till
                        : subscriptionTimeFilters.tillDate;

                log("useEffect.timeFilters", `Updating from ${prev.from} to ${from} and till ${prev.till} to ${till}`);
                return {
                    from,
                    till,
                };
            });
        }
    }, [subscriptionTimeFilters, log]);

    return (
        <Flex direction="row" wrap="wrap" justifyContent="flex-start">
            <VSCodeCheckbox checked={filterOutElementsWithoutTime} name="error" onChange={onCheckboxChange}>
                Filter out entries that don't have a time
            </VSCodeCheckbox>
            <Flex direction="row" wrap="wrap" hFill justifyContent="space-between" style={{ marginTop: "1rem" }}>
                <VSCodeTextField placeholder="YYYY-MM-DD HH:MM" name="from" value={timeFilter.from} onChange={onTextFieldChange}>
                    From
                </VSCodeTextField>
                <VSCodeTextField placeholder="YYYY-MM-DD HH:MM" name="till" value={timeFilter.till} onChange={onTextFieldChange}>
                    Till
                </VSCodeTextField>
            </Flex>
            <h4>Session Id</h4>
            <p>If we find a session id in the summary.txt file, you can filter based on it </p>
            <VSCodeCheckbox disabled={!isSessionIdDefined} onChange={onSessionIdFilterChange} name="filter_session_id">
                Start around session start
            </VSCodeCheckbox>
        </Flex>
    );


};