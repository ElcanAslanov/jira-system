"use client";

import DatePicker from "antd/es/date-picker";
import dayjs, { Dayjs } from "dayjs";

const { RangePicker } = DatePicker;

type Props = {
  value: [string | null, string | null];
  onChange: (value: [string | null, string | null]) => void;
  placeholder: [string, string];
};

export default function DateRangePicker({
  value,
  onChange,
  placeholder,
}: Props) {
  return (
    <RangePicker
      format="DD/MM/YYYY"
      placeholder={placeholder}
      value={[
        value[0] ? dayjs(value[0]) : null,
        value[1] ? dayjs(value[1]) : null,
      ]}
      onChange={(vals: null | [Dayjs | null, Dayjs | null]) => {
        onChange([
          vals?.[0] ? vals[0].format("YYYY-MM-DD") : null,
          vals?.[1] ? vals[1].format("YYYY-MM-DD") : null,
        ]);
      }}
      style={{ width: "100%" }}
    />
  );
}