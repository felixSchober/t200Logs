import * as React from "react";
import { VSCodeTextField, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react";
import { Flex } from "../../common/Flex";
import { useSendAndReceive } from "../../service/useSendAndReceive";
import { useDebounce } from "../../common/useDebounce";

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

    const onCheckboxChange = React.useCallback(
        (event: Event | React.FormEvent<HTMLElement>) => {
            const target = event.target as HTMLInputElement;
            const value = target.checked;
            setFilterOutElementsWithoutTime(value);
            sendFilterNoEventTime({ removeEntriesWithNoEventTime: value });
        },
        [sendFilterNoEventTime]
    );

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

    React.useEffect(() => {
        console.log("debouncedTimeFilter", debouncedTimeFilter, "timeFilterLastUpdated", timeFilterLastUpdated);

        // only execute if the debounced filter has changed and is not the same as the last updated filter
        if (debouncedTimeFilter.from !== timeFilterLastUpdated.from || debouncedTimeFilter.till !== timeFilterLastUpdated.till) {
            setTimeFilterLastUpdated(debouncedTimeFilter);
            sendTime({ fromDate: debouncedTimeFilter.from ?? null, tillDate: debouncedTimeFilter.till ?? null });
        } else {
            console.log("skipping sendTime");
        }
    }, [debouncedTimeFilter, timeFilterLastUpdated, sendTime]);

    return (
        <Flex direction="row" wrap="wrap" justifyContent="flex-start">
            <VSCodeCheckbox checked={filterOutElementsWithoutTime} name="error" onChange={onCheckboxChange}>
                Filter out entries that don't have a time
            </VSCodeCheckbox>
            <VSCodeTextField placeholder="YYYY-MM-DD HH:MM" name="from" value={timeFilter.from} onChange={onTextFieldChange}>
                From
            </VSCodeTextField>
            <VSCodeTextField placeholder="YYYY-MM-DD HH:MM" name="till" value={timeFilter.till} onChange={onTextFieldChange}>
                Till
            </VSCodeTextField>
        </Flex>
    );
};

