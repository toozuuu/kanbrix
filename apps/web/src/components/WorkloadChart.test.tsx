import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import WorkloadChart from "./WorkloadChart";

const { list, counts } = vi.hoisted(() => ({list:vi.fn(), counts:vi.fn()}));
vi.mock("../lib/api", () => ({api:{
  sprints:{list: async () => [{id:"s",name:"Iteration one"}]}, issues:{counts,list},
}}));

it("shows the current split and drills into a sprint with unestimated work", async () => {
  const ada = {id:"a",name:"Ada",count:2,points:5,unestimated:1};
  const kai = {id:"k",name:"Kai",count:1,points:3,unestimated:0};
  const issue = {id:"i",identifier:"P-1",title:"Prepare release"};
  counts.mockResolvedValue({workload:[ada,kai]});
  list.mockResolvedValue([issue]);
  const client = new QueryClient();
  const open = vi.fn();
  const chart = (first:typeof ada) => <QueryClientProvider client={client}>
    <WorkloadChart project="project" rows={[first,kai]} onSelectIssue={open}/>
  </QueryClientProvider>;
  const view = render(chart(ada));
  expect(screen.getByRole("button",{name:/Ada/})).toHaveTextContent("2 (67%)");
  expect(screen.getByRole("button",{name:/Kai/})).toHaveTextContent("1 (33%)");
  view.rerender(chart({...ada,count:1}));
  expect(screen.getAllByText("1 (50%)")).toHaveLength(2);
  await screen.findByRole("option",{name:"Iteration one"});
  fireEvent.change(screen.getByLabelText(/Sprint/),{target:{value:"s"}});
  fireEvent.change(screen.getByLabelText(/Measure/),{target:{value:"points"}});
  expect(await screen.findByText("1 open issue without an estimate")).toBeVisible();
  fireEvent.click(await screen.findByRole("button",{name:/Ada/}));
  fireEvent.click(await screen.findByRole("button",{name:"P-1 Prepare release"}));
  expect(list).toHaveBeenCalledWith("project",expect.objectContaining({sprint_id:"s",assignee_id:"a",open_only:true}));
  expect(open).toHaveBeenCalledWith(issue);
});
