import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SelectBox } from "./SelectBox";

afterEach(cleanup);

it("keeps a saved choice selected until its options load", () => {
  const { rerender } = render(
    <SelectBox aria-label="Priority" value="urgent" unavailableLabel="Saved priority" onChange={() => {}}>
      <option value="normal">Normal</option>
    </SelectBox>,
  );

  expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("urgent");
  expect((screen.getByRole("option", { name: "Saved priority" }) as HTMLOptionElement).disabled).toBe(true);

  rerender(
    <SelectBox aria-label="Priority" value="urgent" onChange={() => {}}>
      <option value="normal">Normal</option>
      <option value="urgent">Urgent</option>
    </SelectBox>,
  );

  expect((screen.getByRole("option", { name: "Urgent" }) as HTMLOptionElement).selected).toBe(true);
  expect(screen.queryByText("Saved priority")).toBeNull();
});
